import crypto from 'node:crypto';
import { Router } from 'express';
import { config } from '../config.js';
import { getRepositorySettings, isRepositoryWithinAnyUserPlan, markInstallationSuspended, recordWebhookEvent, upsertGitHubInstallation, upsertPullRequest, upsertRepository } from '../db/queries.js';
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

    if (eventName === 'installation') {
      await handleInstallationEvent(payload);
      return res.status(202).json({ ok: true, installation: true });
    }

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
      githubInstallationId: jobData.installationId,
      owner: jobData.repoOwner,
      name: jobData.repoName,
      fullName: jobData.repoFullName
    });
    const settings = await getRepositorySettings(repoId);
    const planAllowsRepository = await isRepositoryWithinAnyUserPlan(repoId);
    if (!planAllowsRepository) {
      return res.status(202).json({
        ok: true,
        queued: false,
        ignored: true,
        reason: 'Repository is outside the active plan limit.'
      });
    }

    const actionEnabled =
      (payload.action === 'opened' && settings.reviewOnOpened) ||
      (payload.action === 'synchronize' && settings.reviewOnSynchronize) ||
      (payload.action === 'reopened' && settings.reviewOnReopened);

    await upsertPullRequest({
      repoId,
      prNumber: jobData.prNumber,
      title: jobData.prTitle,
      author: jobData.prAuthor,
      headSha: jobData.headSha,
      status: 'pending'
    });

    if (!settings.enabled || !actionEnabled) {
      return res.status(202).json({
        ok: true,
        queued: false,
        ignored: true,
        reason: !settings.enabled ? 'Repository reviews are disabled.' : `Review on ${payload.action} is disabled for this repository.`
      });
    }

    jobData.reviewTone = settings.reviewTone as 'light' | 'balanced' | 'strict';
    jobData.maxReviewComments = settings.maxComments;
    jobData.maxInlineReviewComments = settings.maxInlineComments;
    jobData.maxInlineCommentsPerFile = settings.maxInlineCommentsPerFile;
    jobData.ignoredPatterns = settings.ignoredPatterns
      .split('\n')
      .map((pattern) => pattern.trim())
      .filter(Boolean);

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

async function handleInstallationEvent(payload: any) {
  const installationId = Number(payload.installation?.id);
  if (!installationId) return;

  if (['deleted', 'suspend'].includes(payload.action)) {
    await markInstallationSuspended(installationId);
    return;
  }

  await upsertGitHubInstallation({
    githubInstallationId: installationId,
    accountGithubId: payload.installation?.account?.id ? Number(payload.installation.account.id) : null,
    accountLogin: payload.installation?.account?.login ?? null,
    accountType: payload.installation?.account?.type ?? null
  });

  for (const repository of payload.repositories ?? payload.repositories_added ?? []) {
    const fullName = String(repository.full_name ?? '');
    const [owner, nameFromFullName] = fullName.split('/');
    await upsertRepository({
      githubId: Number(repository.id),
      githubInstallationId: installationId,
      owner: owner || String(repository.owner?.login ?? ''),
      name: String(repository.name ?? nameFromFullName ?? ''),
      fullName
    });
  }
}
