import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { config } from '../config.js';
import { linkUserInstallation, replaceUserInstallations, upsertGitHubInstallation, upsertRepository } from '../db/queries.js';
import { prisma } from '../db/prisma.js';
import { redisConnection } from '../queue/redis.js';
import { listUserInstallationRepositories, listUserInstallations } from './github.service.js';
import type { AuthUser } from '../types/index.js';
import { logger } from '../utils/logger.js';

export const authSessionCookieName = '__session';

interface GitHubTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GitHubUserResponse {
  id: number;
  login: string;
  avatar_url?: string | null;
  email?: string | null;
}

interface GitHubEmailResponse {
  email: string;
  primary: boolean;
  verified: boolean;
}

interface GitHubOAuthState {
  purpose: 'github_oauth';
  nonce: string;
  returnTo: string;
}

export function createGitHubOAuthState(returnTo: string) {
  return jwt.sign(
    {
      purpose: 'github_oauth',
      nonce: crypto.randomBytes(24).toString('hex'),
      returnTo
    } satisfies GitHubOAuthState,
    config.JWT_SECRET,
    { expiresIn: '10m' }
  );
}

export function verifyGitHubOAuthState(state: string) {
  const payload = jwt.verify(state, config.JWT_SECRET) as Partial<GitHubOAuthState>;
  if (payload.purpose !== 'github_oauth' || typeof payload.returnTo !== 'string') {
    throw new Error('Invalid GitHub OAuth state.');
  }

  return {
    returnTo: payload.returnTo
  };
}

export function getGitHubAuthUrl(state: string) {
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', config.GITHUB_CLIENT_ID);
  url.searchParams.set('redirect_uri', config.GITHUB_CALLBACK_URL);
  url.searchParams.set('scope', 'read:user user:email');
  url.searchParams.set('state', state);
  url.searchParams.set('prompt', 'select_account');
  return url.toString();
}

export async function completeGitHubOAuth(code: string) {
  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      client_id: config.GITHUB_CLIENT_ID,
      client_secret: config.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: config.GITHUB_CALLBACK_URL
    })
  });

  if (!tokenResponse.ok) {
    throw new Error(`GitHub OAuth token exchange failed (${tokenResponse.status}).`);
  }

  const tokenJson = (await tokenResponse.json()) as GitHubTokenResponse;
  if (!tokenJson.access_token) {
    throw new Error(tokenJson.error_description ?? tokenJson.error ?? 'GitHub OAuth did not return an access token.');
  }

  const githubUser = await fetchGitHubUser(tokenJson.access_token);
  const email = githubUser.email ?? (await fetchPrimaryEmail(tokenJson.access_token));
  const existingUserCount = await prisma.user.count();

  const user = await prisma.user.upsert({
    where: { githubId: BigInt(githubUser.id) },
    create: {
      githubId: BigInt(githubUser.id),
      username: githubUser.login,
      email,
      avatarUrl: githubUser.avatar_url ?? null,
      role: existingUserCount === 0 ? 'owner' : 'viewer'
    },
    update: {
      username: githubUser.login,
      email,
      avatarUrl: githubUser.avatar_url ?? null,
      lastLogin: new Date()
    }
  });

  const authUser: AuthUser = {
    userId: user.id,
    githubId: user.githubId.toString(),
    username: user.username,
    avatarUrl: user.avatarUrl,
    role: user.role === 'owner' ? 'owner' : 'viewer'
  };

  await storeSession(authUser.userId, tokenJson.access_token);
  await syncUserInstallations(authUser.userId, tokenJson.access_token);

  return {
    user: authUser,
    token: signAuthToken(authUser)
  };
}

export async function syncUserInstallations(userId: number, accessToken: string) {
  try {
    const installations = await listUserInstallations(accessToken);
    const activeInstallationIds: number[] = [];

    for (const installation of installations.installations ?? []) {
      const savedInstallation = await upsertGitHubInstallation({
        githubInstallationId: installation.id,
        accountGithubId: installation.account?.id ?? null,
        accountLogin: installation.account?.login ?? null,
        accountType: installation.account?.type ?? null
      });

      activeInstallationIds.push(savedInstallation.id);
      await linkUserInstallation(userId, savedInstallation.id);

      const repositories = await listUserInstallationRepositories(accessToken, installation.id);
      for (const repository of repositories.repositories ?? []) {
        const repoOwner = repository.owner?.login ?? repository.full_name.split('/')[0];
        await upsertRepository({
          githubId: repository.id,
          githubInstallationId: installation.id,
          owner: repoOwner,
          name: repository.name,
          fullName: repository.full_name
        });
      }
    }

    await replaceUserInstallations(userId, activeInstallationIds);
  } catch (error) {
    logger.warn('Could not sync GitHub installations for signed-in user.', error);
  }
}

export function signAuthToken(user: AuthUser) {
  return jwt.sign(user, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRY_SECONDS
  });
}

export function verifyAuthToken(token: string) {
  return jwt.verify(token, config.JWT_SECRET) as AuthUser;
}

export async function storeSession(userId: number, githubAccessToken: string) {
  await redisConnection.set(
    sessionKey(userId),
    JSON.stringify({
      githubAccessToken,
      lastActive: new Date().toISOString(),
      refreshedAt: new Date().toISOString()
    }),
    'EX',
    config.JWT_EXPIRY_SECONDS
  );
}

export async function refreshSession(userId: number) {
  const session = await redisConnection.get(sessionKey(userId));
  if (!session) return false;

  const sessionJson = safeParseSession(session);
  const refreshedAt = sessionJson?.refreshedAt ? Date.parse(sessionJson.refreshedAt) : 0;
  const shouldRefresh = !refreshedAt || Date.now() - refreshedAt > config.SESSION_REFRESH_INTERVAL_SECONDS * 1000;

  if (shouldRefresh) {
    await redisConnection.set(
      sessionKey(userId),
      JSON.stringify({
        ...sessionJson,
        lastActive: new Date().toISOString(),
        refreshedAt: new Date().toISOString()
      }),
      'EX',
      config.JWT_EXPIRY_SECONDS
    );
  }

  return true;
}

export async function getSessionGitHubAccessToken(userId: number) {
  const session = await redisConnection.get(sessionKey(userId));
  const sessionJson = session ? safeParseSession(session) : null;
  return sessionJson?.githubAccessToken ?? null;
}

export async function clearSession(userId: number) {
  await redisConnection.del(sessionKey(userId));
}

export async function clearSessionAndRevokeGitHub(userId: number) {
  const session = await redisConnection.get(sessionKey(userId));
  const sessionJson = session ? safeParseSession(session) : null;
  await redisConnection.del(sessionKey(userId));

  if (!sessionJson?.githubAccessToken) return;

  await revokeGitHubAuthorization(sessionJson.githubAccessToken);
}

function sessionKey(userId: number) {
  return `session:${userId}`;
}

function safeParseSession(session: string) {
  try {
    return JSON.parse(session) as {
      githubAccessToken?: string;
      lastActive?: string;
      refreshedAt?: string;
    };
  } catch {
    return null;
  }
}

async function fetchGitHubUser(accessToken: string) {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': 'ai-pr-review-bot'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch GitHub user (${response.status}).`);
  }

  return (await response.json()) as GitHubUserResponse;
}

async function fetchPrimaryEmail(accessToken: string) {
  const response = await fetch('https://api.github.com/user/emails', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': 'ai-pr-review-bot'
    }
  });

  if (!response.ok) return null;

  const emails = (await response.json()) as GitHubEmailResponse[];
  return emails.find((email) => email.primary && email.verified)?.email ?? null;
}

async function revokeGitHubAuthorization(accessToken: string) {
  if (!config.GITHUB_CLIENT_ID || !config.GITHUB_CLIENT_SECRET) return;

  const credentials = Buffer.from(`${config.GITHUB_CLIENT_ID}:${config.GITHUB_CLIENT_SECRET}`).toString('base64');
  const response = await fetch(`https://api.github.com/applications/${config.GITHUB_CLIENT_ID}/grant`, {
    method: 'DELETE',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
      'User-Agent': 'ai-pr-review-bot',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    body: JSON.stringify({ access_token: accessToken })
  });

  if (!response.ok && response.status !== 404) {
    throw new Error(`GitHub OAuth authorization revoke failed (${response.status}).`);
  }
}
