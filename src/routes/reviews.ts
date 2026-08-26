import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { prisma } from '../db/prisma.js';
import { getReviewDetail, getStats, listRecentReviews, listRepositories, updateRepositorySelection, updateRepositorySettings } from '../db/queries.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { getSessionGitHubAccessToken, syncUserInstallations } from '../services/auth.service.js';
import { createRazorpayOrder, fetchRazorpayOrder, freePlan, getRazorpayPlan, getUserPlanAccess, isRazorpayCheckoutReady, razorpayPlans, verifyRazorpayPaymentSignature } from '../services/razorpay.service.js';

export const reviewsRouter = Router();

reviewsRouter.use('/api', authMiddleware);

const repositorySettingsSchema = z.object({
  enabled: z.boolean(),
  review_on_opened: z.boolean(),
  review_on_synchronize: z.boolean(),
  review_on_reopened: z.boolean(),
  max_comments: z.coerce.number().int().min(1).max(20),
  max_inline_comments: z.coerce.number().int().min(0).max(config.MAX_INLINE_REVIEW_COMMENTS),
  max_inline_comments_per_file: z.coerce.number().int().min(1).max(config.MAX_INLINE_COMMENTS_PER_FILE),
  review_tone: z.enum(['light', 'balanced', 'strict']),
  ignored_patterns: z.string().max(2000).default('')
});

const razorpayVerifySchema = z.object({
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
  planId: z.enum(['basic', 'pro', 'scale'])
});

const razorpayOrderSchema = z.object({
  planId: z.enum(['basic', 'pro', 'scale'])
});

const repositorySelectionSchema = z.object({
  selected: z.boolean()
});

reviewsRouter.get('/api/reviews', requirePlanAccess, async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 50), 100);
    const reviews = await listRecentReviews(await toActor(req), limit);
    res.json({ reviews });
  } catch (error) {
    next(error);
  }
});

reviewsRouter.get('/api/repos', requirePlanAccess, async (req, res, next) => {
  try {
    const repositories = await listRepositories(await toActor(req));
    res.json({ repositories });
  } catch (error) {
    next(error);
  }
});

reviewsRouter.post('/api/github/sync', requirePlanAccess, async (req, res, next) => {
  try {
    const accessToken = await getSessionGitHubAccessToken(req.user!.userId);
    if (!accessToken) {
      return res.status(401).json({ error: 'GitHub session expired. Sign in again to refresh repository access.' });
    }

    await syncUserInstallations(req.user!.userId, accessToken);
    const repositories = await listRepositories(await toActor(req));
    return res.json({ repositories });
  } catch (error) {
    return next(error);
  }
});

reviewsRouter.patch('/api/repos/:id/settings', requirePlanAccess, async (req, res, next) => {
  try {
    const repoId = Number(req.params.id);
    if (!Number.isInteger(repoId) || repoId <= 0) {
      return res.status(400).json({ error: 'Invalid repository id.' });
    }

    const parsed = repositorySettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid repository settings.', details: parsed.error.flatten() });
    }

    const settings = await updateRepositorySettings(repoId, await toActor(req), {
      enabled: parsed.data.enabled,
      reviewOnOpened: parsed.data.review_on_opened,
      reviewOnSynchronize: parsed.data.review_on_synchronize,
      reviewOnReopened: parsed.data.review_on_reopened,
      maxComments: parsed.data.max_comments,
      maxInlineComments: parsed.data.max_inline_comments,
      maxInlineCommentsPerFile: parsed.data.max_inline_comments_per_file,
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
        max_inline_comments: settings.maxInlineComments,
        max_inline_comments_per_file: settings.maxInlineCommentsPerFile,
        review_tone: settings.reviewTone,
        ignored_patterns: settings.ignoredPatterns
      }
    });
  } catch (error) {
    next(error);
  }
});

reviewsRouter.patch('/api/repos/:id/selection', requirePlanAccess, async (req, res, next) => {
  try {
    const repoId = Number(req.params.id);
    if (!Number.isInteger(repoId) || repoId <= 0) {
      return res.status(400).json({ error: 'Invalid repository id.' });
    }

    const parsed = repositorySelectionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid repository selection.', details: parsed.error.flatten() });
    }

    const selection = await updateRepositorySelection(repoId, await toActor(req), parsed.data.selected);
    if (!selection) return res.status(404).json({ error: 'Repository not found.' });

    return res.json({ selection });
  } catch (error) {
    if (error instanceof Error && error.message.includes('plan')) {
      return res.status(400).json({ error: error.message });
    }

    return next(error);
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

reviewsRouter.get('/api/billing', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        planName: true,
        billingStatus: true,
        razorpayPaymentId: true,
        paidAt: true
      }
    });
    const checkoutReady = isRazorpayCheckoutReady();
    const paymentReady = Boolean(checkoutReady || config.RAZORPAY_CUSTOMER_PORTAL_URL);
    const access = getUserPlanAccess(user);

    res.json({
      billing: {
        plan_name: access.plan.name,
        current_plan_id: access.plan.id,
        repo_limit: access.plan.repoLimit,
        billing_status: user?.billingStatus ?? 'free',
        status: paymentReady ? 'ready' : 'setup_required',
        checkout_ready: checkoutReady,
        key_id: checkoutReady ? config.RAZORPAY_KEY_ID : null,
        currency: config.RAZORPAY_CURRENCY,
        plans: [freePlan, ...razorpayPlans],
        customer_portal_url: config.RAZORPAY_CUSTOMER_PORTAL_URL || null,
        latest_payment_id: user?.razorpayPaymentId ?? null,
        paid_at: user?.paidAt?.toISOString() ?? null
      }
    });
  } catch (error) {
    next(error);
  }
});

reviewsRouter.post('/api/billing/razorpay/order', async (req, res, next) => {
  try {
    const parsed = razorpayOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid Razorpay order payload.', details: parsed.error.flatten() });
    }

    const plan = getRazorpayPlan(parsed.data.planId)!;
    const order = await createRazorpayOrder(await toActor(req), parsed.data.planId);
    await prisma.user.update({
      where: { id: req.user!.userId },
      data: {
        razorpayOrderId: order.id,
        billingStatus: 'payment_pending'
      }
    });

    res.json({
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
        plan_name: plan.name,
        plan_id: plan.id
      }
    });
  } catch (error) {
    next(error);
  }
});

reviewsRouter.post('/api/billing/razorpay/verify', async (req, res, next) => {
  try {
    const parsed = razorpayVerifySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid Razorpay verification payload.', details: parsed.error.flatten() });
    }

    const verified = verifyRazorpayPaymentSignature(parsed.data);
    if (!verified) return res.status(400).json({ error: 'Payment signature verification failed.' });

    const plan = getRazorpayPlan(parsed.data.planId)!;
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { razorpayOrderId: true, billingStatus: true }
    });

    if (user?.razorpayOrderId !== parsed.data.razorpayOrderId || user.billingStatus !== 'payment_pending') {
      return res.status(400).json({ error: 'Payment order does not match the active checkout session.' });
    }

    const order = await fetchRazorpayOrder(parsed.data.razorpayOrderId);
    if (
      order.amount !== plan.amount ||
      order.currency !== config.RAZORPAY_CURRENCY ||
      order.notes?.user_id !== String(req.user!.userId) ||
      order.notes?.plan_id !== plan.id
    ) {
      return res.status(400).json({ error: 'Payment order details do not match the selected plan.' });
    }

    await prisma.user.update({
      where: { id: req.user!.userId },
      data: {
        planName: plan.name,
        billingStatus: 'active',
        razorpayOrderId: parsed.data.razorpayOrderId,
        razorpayPaymentId: parsed.data.razorpayPaymentId,
        paidAt: new Date()
      }
    });

    return res.json({
      ok: true,
      billing: {
        plan_name: plan.name,
        billing_status: 'active'
      }
    });
  } catch (error) {
    next(error);
  }
});

reviewsRouter.get('/api/stats', requirePlanAccess, async (req, res, next) => {
  try {
    const stats = await getStats(await toActor(req));
    res.json({ stats });
  } catch (error) {
    next(error);
  }
});

reviewsRouter.get('/api/reviews/:id', requirePlanAccess, async (req, res, next) => {
  try {
    const review = await getReviewDetail(await toActor(req), Number(req.params.id));
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

async function requirePlanAccess(req: any, res: any, next: any) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { billingStatus: true, planName: true }
    });
    const access = getUserPlanAccess(user);

    if (!access.hasDashboardAccess) {
      return res.status(402).json({ error: 'Plan access required.' });
    }

    return next();
  } catch (error) {
    return next(error);
  }
}

async function toActor(req: any) {
  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: { billingStatus: true, planName: true }
  });
  const access = getUserPlanAccess(user);

  return {
    userId: req.user.userId,
    username: req.user.username,
    repoLimit: access.plan.repoLimit
  };
}
