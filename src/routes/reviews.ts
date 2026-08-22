import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { getReviewDetail, getStats, listRecentReviews, listRepositories, updateRepositorySettings } from '../db/queries.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

export const reviewsRouter = Router();

reviewsRouter.use('/api', authMiddleware);

const repositorySettingsSchema = z.object({
  enabled: z.boolean(),
  review_on_opened: z.boolean(),
  review_on_synchronize: z.boolean(),
  review_on_reopened: z.boolean(),
  max_comments: z.coerce.number().int().min(1).max(20),
  review_tone: z.enum(['light', 'balanced', 'strict']),
  ignored_patterns: z.string().max(2000).default('')
});

reviewsRouter.get('/api/reviews', async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 50), 100);
    const reviews = await listRecentReviews(toActor(req), limit);
    res.json({ reviews });
  } catch (error) {
    next(error);
  }
});

reviewsRouter.get('/api/repos', async (req, res, next) => {
  try {
    const repositories = await listRepositories(toActor(req));
    res.json({ repositories });
  } catch (error) {
    next(error);
  }
});

reviewsRouter.patch('/api/repos/:id/settings', async (req, res, next) => {
  try {
    const repoId = Number(req.params.id);
    if (!Number.isInteger(repoId) || repoId <= 0) {
      return res.status(400).json({ error: 'Invalid repository id.' });
    }

    const parsed = repositorySettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid repository settings.', details: parsed.error.flatten() });
    }

    const settings = await updateRepositorySettings(repoId, toActor(req), {
      enabled: parsed.data.enabled,
      reviewOnOpened: parsed.data.review_on_opened,
      reviewOnSynchronize: parsed.data.review_on_synchronize,
      reviewOnReopened: parsed.data.review_on_reopened,
      maxComments: parsed.data.max_comments,
      reviewTone: parsed.data.review_tone,
      ignoredPatterns: normalizeIgnoredPatterns(parsed.data.ignored_patterns)
    });

    if (!settings) return res.status(404).json({ error: 'Repository not found.' });

    return res.json({
      settings: {
        enabled: settings.enabled,
        review_on_opened: settings.reviewOnOpened,
        review_on_synchronize: settings.reviewOnSynchronize,
        review_on_reopened: settings.reviewOnReopened,
        max_comments: settings.maxComments,
        review_tone: settings.reviewTone,
        ignored_patterns: settings.ignoredPatterns
      }
    });
  } catch (error) {
    next(error);
  }
});

reviewsRouter.get('/api/setup', async (_req, res) => {
  const installUrl = config.GITHUB_APP_SLUG ? `https://github.com/apps/${config.GITHUB_APP_SLUG}/installations/new` : null;
  res.json({
    setup: {
      github_app_slug: config.GITHUB_APP_SLUG || null,
      github_install_url: installUrl,
      public_base_url: config.PUBLIC_BASE_URL,
      webhook_url: `${config.PUBLIC_BASE_URL.replace(/\/$/, '')}/webhook`,
      callback_url: config.GITHUB_CALLBACK_URL
    }
  });
});

reviewsRouter.get('/api/billing', async (_req, res) => {
  const paymentReady = Boolean(config.RAZORPAY_PAYMENT_LINK_URL || config.RAZORPAY_CUSTOMER_PORTAL_URL);

  res.json({
    billing: {
      plan_name: paymentReady ? 'Pro' : 'Free',
      status: paymentReady ? 'ready' : 'setup_required',
      payment_link_url: config.RAZORPAY_PAYMENT_LINK_URL || null,
      customer_portal_url: config.RAZORPAY_CUSTOMER_PORTAL_URL || null
    }
  });
});

reviewsRouter.get('/api/stats', async (req, res, next) => {
  try {
    const stats = await getStats(toActor(req));
    res.json({ stats });
  } catch (error) {
    next(error);
  }
});

reviewsRouter.get('/api/reviews/:id', async (req, res, next) => {
  try {
    const review = await getReviewDetail(toActor(req), Number(req.params.id));
    if (!review) return res.status(404).json({ error: 'Review not found.' });
    return res.json({ review });
  } catch (error) {
    next(error);
  }
});

function normalizeIgnoredPatterns(value: string) {
  return value
    .split('\n')
    .map((pattern) => pattern.trim())
    .filter(Boolean)
    .slice(0, 50)
    .join('\n');
}

function toActor(req: any) {
  return {
    userId: req.user.userId,
    username: req.user.username
  };
}
