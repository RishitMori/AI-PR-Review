import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { linkUserInstallation, upsertGitHubInstallation, upsertRepository } from '../db/queries.js';
import { prisma } from '../db/prisma.js';
import { redisConnection } from '../queue/redis.js';
import { listUserInstallationRepositories, listUserInstallations } from './github.service.js';
import type { AuthUser } from '../types/index.js';
import { logger } from '../utils/logger.js';

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

export function getGitHubAuthUrl() {
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', config.GITHUB_CLIENT_ID);
  url.searchParams.set('redirect_uri', config.GITHUB_CALLBACK_URL);
  url.searchParams.set('scope', 'read:user user:email');
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

async function syncUserInstallations(userId: number, accessToken: string) {
  try {
    const installations = await listUserInstallations(accessToken);

    for (const installation of installations.installations ?? []) {
      const savedInstallation = await upsertGitHubInstallation({
        githubInstallationId: installation.id,
        accountGithubId: installation.account?.id ?? null,
        accountLogin: installation.account?.login ?? null,
        accountType: installation.account?.type ?? null
      });

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

export async function clearSession(userId: number) {
  await redisConnection.del(sessionKey(userId));
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
