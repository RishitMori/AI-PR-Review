import { Router } from 'express';
import crypto from 'node:crypto';
import { config } from '../config.js';
import { clearSessionAndRevokeGitHub, completeGitHubOAuth, getGitHubAuthUrl, verifyAuthToken } from '../services/auth.service.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

export const authRouter = Router();
const githubOAuthStateCookie = 'github_oauth_state';
const authReturnToCookie = 'auth_return_to';

authRouter.get('/auth/github', (req, res) => {
  const state = crypto.randomBytes(24).toString('hex');
  const returnTo = sanitizeReturnTo(String(req.query.return_to ?? ''));
  res.cookie(githubOAuthStateCookie, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.COOKIE_SECURE,
    maxAge: 10 * 60 * 1000,
    path: '/auth/github/callback'
  });
  if (returnTo) {
    res.cookie(authReturnToCookie, returnTo, {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.COOKIE_SECURE,
      maxAge: 10 * 60 * 1000,
      path: '/auth/github/callback'
    });
  }
  res.redirect(getGitHubAuthUrl(state));
});

authRouter.get('/auth/github/callback', async (req, res, next) => {
  try {
    const code = String(req.query.code ?? '');
    const state = String(req.query.state ?? '');
    const expectedState = req.cookies?.[githubOAuthStateCookie];
    if (!code) return res.status(400).send('Missing GitHub OAuth code.');
    if (!state || !expectedState || state !== expectedState) {
      res.clearCookie(githubOAuthStateCookie, { path: '/auth/github/callback' });
      return res.status(400).send('Invalid GitHub OAuth state.');
    }

    const result = await completeGitHubOAuth(code);
    const returnTo = sanitizeReturnTo(String(req.cookies?.[authReturnToCookie] ?? ''));
    res.clearCookie(githubOAuthStateCookie, { path: '/auth/github/callback' });
    res.clearCookie(authReturnToCookie, { path: '/auth/github/callback' });
    res.cookie('token', result.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.COOKIE_SECURE,
      maxAge: config.JWT_EXPIRY_SECONDS * 1000,
      path: '/'
    });

    return res.redirect(returnTo || '/dashboard');
  } catch (error) {
    return next(error);
  }
});

authRouter.post('/auth/logout', async (req, res, next) => {
  try {
    const token = req.cookies?.token;
    if (token) {
      try {
        const user = verifyAuthToken(token);
        await clearSessionAndRevokeGitHub(user.userId);
      } catch {
        // Clear local cookies even when the session is already invalid.
      }
    }

    res.clearCookie('token', { path: '/' });
    res.clearCookie(githubOAuthStateCookie, { path: '/auth/github/callback' });
    res.clearCookie(authReturnToCookie, { path: '/auth/github/callback' });
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

authRouter.get('/auth/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

function sanitizeReturnTo(value: string) {
  if (!value.startsWith('/')) return '';
  if (value.startsWith('//')) return '';
  if (value.startsWith('/auth') || value.startsWith('/api') || value.startsWith('/webhook')) return '';
  return value.slice(0, 200);
}
