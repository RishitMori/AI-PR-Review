import jwt from 'jsonwebtoken';
import { config, githubPrivateKey } from '../config.js';

interface GitHubApiErrorBody {
  message?: string;
}

async function githubRequest<T>(url: string, options: RequestInit & { token?: string } = {}) {
  const headers = new Headers(options.headers);
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/vnd.github+json');
  }
  headers.set('X-GitHub-Api-Version', '2022-11-28');
  headers.set('User-Agent', 'ai-pr-review-bot');

  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (!response.ok) {
    let body: GitHubApiErrorBody | string = await response.text();
    try {
      body = JSON.parse(body) as GitHubApiErrorBody;
    } catch {
      // Keep plain text body.
    }

    const message = typeof body === 'string' ? body : body.message;
    throw new Error(`GitHub API failed (${response.status}): ${message ?? response.statusText}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return (await response.json()) as T;
  }

  return (await response.text()) as T;
}

function createAppJwt() {
  if (!githubPrivateKey.includes('BEGIN') || !githubPrivateKey.includes('PRIVATE KEY')) {
    throw new Error(
      'GITHUB_PRIVATE_KEY is not a valid PEM private key. Paste the full GitHub App .pem content into .env and keep newlines as \\n if it is on one line.'
    );
  }

  const now = Math.floor(Date.now() / 1000);

  return jwt.sign(
    {
      iat: now - 60,
      exp: now + 9 * 60,
      iss: config.GITHUB_APP_ID
    },
    githubPrivateKey,
    { algorithm: 'RS256' }
  );
}

export async function getInstallationToken(installationId: number) {
  const appJwt = createAppJwt();
  const result = await githubRequest<{ token: string }>(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      token: appJwt
    }
  );

  return result.token;
}

export async function fetchPullRequestDiff(input: {
  token: string;
  owner: string;
  repo: string;
  prNumber: number;
}) {
  return githubRequest<string>(
    `https://api.github.com/repos/${input.owner}/${input.repo}/pulls/${input.prNumber}`,
    {
      token: input.token,
      headers: {
        Accept: 'application/vnd.github.v3.diff'
      }
    }
  );
}

export async function postPrSummaryComment(input: {
  token: string;
  owner: string;
  repo: string;
  prNumber: number;
  body: string;
}) {
  return githubRequest<{ id: number; html_url: string }>(
    `https://api.github.com/repos/${input.owner}/${input.repo}/issues/${input.prNumber}/comments`,
    {
      method: 'POST',
      token: input.token,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ body: input.body })
    }
  );
}

export async function updatePrSummaryComment(input: {
  token: string;
  owner: string;
  repo: string;
  commentId: number;
  body: string;
}) {
  return githubRequest<{ id: number; html_url: string }>(
    `https://api.github.com/repos/${input.owner}/${input.repo}/issues/comments/${input.commentId}`,
    {
      method: 'PATCH',
      token: input.token,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ body: input.body })
    }
  );
}
