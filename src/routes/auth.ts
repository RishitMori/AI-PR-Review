import { Router } from 'express';
import { config } from '../config.js';
import { clearSession, completeGitHubOAuth, getGitHubAuthUrl } from '../services/auth.service.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

export const authRouter = Router();

authRouter.get('/auth/github', (_req, res) => {
  res.redirect(getGitHubAuthUrl());
});

authRouter.get('/auth/github/callback', async (req, res, next) => {
  try {
    const code = String(req.query.code ?? '');
    if (!code) return res.status(400).send('Missing GitHub OAuth code.');

    const result = await completeGitHubOAuth(code);
    res.cookie('token', result.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.COOKIE_SECURE,
      maxAge: config.JWT_EXPIRY_SECONDS * 1000,
      path: '/'
    });

    return res.redirect('/dashboard');
  } catch (error) {
    return next(error);
  }
});

authRouter.post('/auth/logout', authMiddleware, async (req, res, next) => {
  try {
    if (req.user) {
      await clearSession(req.user.userId);
    }

    res.clearCookie('token', { path: '/' });
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

authRouter.get('/auth/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});
