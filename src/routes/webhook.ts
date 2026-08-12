import crypto from 'node:crypto';
import { Router } from 'express';
import { config } from '../config.js';
import { recordWebhookEvent, upsertPullRequest, upsertRepository } from '../db/queries.js';
import { reviewJobId, reviewQueue } from '../queue/review.queue.js';
import type { ReviewJobData } from '../types/index.js';
import { verifyWebhookSignature } from '../utils/webhook-verify.js';

export const webhookRouter = Router();

webhookRouter.post('/webhook', async (req, res, next) => {
  try {
    const rawBody = req.body as Buffer;
    const signature = req.header('x-hub-signature-256') ?? undefined;

    if (!verifyWebhookSignature(rawBody, signature, config.GITHUB_WEBHOOK_SECRET)) {
      return res.status(401).json({ error: 'Invalid GitHub webhook signature.' });
    }

    const eventName = req.header('x-github-event') ?? 'unknown';
    const deliveryId = req.header('x-github-delivery') ?? crypto.randomUUID();
    const payload = JSON.parse(rawBody.toString('utf8'));

    await recordWebhookEvent({
      deliveryId,
      eventName,
      action: payload.action,
      repoFullName: payload.repository?.full_name,
      prNumber: payload.pull_request?.number
    });

    if (eventName !== 'pull_request') {
      return res.status(202).json({ ok: true, ignored: true, reason: `Ignored ${eventName} event.` });
    }

    if (!['opened', 'synchronize', 'reopened'].includes(payload.action)) {
      return res.status(202).json({ ok: true, ignored: true, reason: `Ignored action ${payload.action}.` });
    }

    if (!payload.installation?.id) {
      return res.status(400).json({ error: 'Webhook payload is missing installation.id.' });
    }

    const jobData = toReviewJobData(deliveryId, payload);
    const repoId = await upsertRepository({
      githubId: jobData.repoGithubId,
      owner: jobData.repoOwner,
      name: jobData.repoName,
      fullName: jobData.repoFullName
    });

    await upsertPullRequest({
      repoId,
      prNumber: jobData.prNumber,
      title: jobData.prTitle,
      author: jobData.prAuthor,
      headSha: jobData.headSha,
      status: 'pending'
    });

    const job = await reviewQueue.add('review-pr', jobData, {
      jobId: reviewJobId(jobData)
    });

    return res.status(202).json({
      ok: true,
      queued: true,
      jobId: job.id
    });
  } catch (error) {
    next(error);
  }
});

function toReviewJobData(deliveryId: string, payload: any): ReviewJobData {
  const repoFullName = String(payload.repository.full_name);
  const [repoOwner, repoName] = repoFullName.split('/');

  return {
    deliveryId,
    installationId: Number(payload.installation.id),
    repoOwner,
    repoName,
    repoFullName,
    repoGithubId: Number(payload.repository.id),
    prNumber: Number(payload.pull_request.number),
    prTitle: String(payload.pull_request.title ?? ''),
    prBody: String(payload.pull_request.body ?? ''),
    prAuthor: String(payload.pull_request.user?.login ?? ''),
    headSha: String(payload.pull_request.head?.sha ?? '')
  };
}
