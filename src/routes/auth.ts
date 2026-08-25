import { Router } from 'express';
import { config } from '../config.js';
import { authSessionCookieName, clearSessionAndRevokeGitHub, completeGitHubOAuth, createGitHubOAuthState, getGitHubAuthUrl, verifyAuthToken, verifyGitHubOAuthState } from '../services/auth.service.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

export const authRouter = Router();

authRouter.get('/auth/github', (req, res) => {
  const returnTo = sanitizeReturnTo(String(req.query.return_to ?? ''));
  const state = createGitHubOAuthState(returnTo);
  res.redirect(getGitHubAuthUrl(state));
});

authRouter.get('/auth/github/callback', async (req, res, next) => {
  try {
    const code = String(req.query.code ?? '');
    const state = String(req.query.state ?? '');
    if (!code) return res.status(400).send('Missing GitHub OAuth code.');
    let oauthState: { returnTo: string };
    try {
      oauthState = verifyGitHubOAuthState(state);
    } catch {
      return res.status(400).send('Invalid GitHub OAuth state.');
    }

    const result = await completeGitHubOAuth(code);
    const returnTo = sanitizeReturnTo(oauthState.returnTo);
    res.cookie(authSessionCookieName, result.token, {
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
    const token = req.cookies?.[authSessionCookieName] ?? req.cookies?.token;
    if (token) {
      try {
        const user = verifyAuthToken(token);
        await clearSessionAndRevokeGitHub(user.userId);
      } catch {
        // Clear local cookies even when the session is already invalid.
      }
    }

    res.clearCookie(authSessionCookieName, { path: '/' });
    res.clearCookie('token', { path: '/' });
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
