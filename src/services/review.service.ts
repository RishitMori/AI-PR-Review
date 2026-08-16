import { config } from '../config.js';
import {
  findCompletedPullRequest,
  findLatestSummaryCommentId,
  saveReview,
  setPullRequestFailure,
  setPullRequestStatus,
  setSummaryCommentId,
  upsertPullRequest,
  upsertRepository
} from '../db/queries.js';
import type { ReviewJobData } from '../types/index.js';
import { filterAndLimitDiff } from '../utils/diff.js';
import { formatSummaryComment } from './comment-format.service.js';
import { fetchPullRequestDiff, getInstallationToken, postPrSummaryComment, updatePrSummaryComment } from './github.service.js';
import { reviewDiffWithLlm } from './llm.service.js';

export async function processReviewJob(data: ReviewJobData) {
  const repoId = await upsertRepository({
    githubId: data.repoGithubId,
    githubInstallationId: data.installationId,
    owner: data.repoOwner,
    name: data.repoName,
    fullName: data.repoFullName
  });

  const existingCompleted = await findCompletedPullRequest(repoId, data.prNumber, data.headSha);
  if (existingCompleted) {
    return {
      skipped: true,
      reason: 'Review already completed for this PR head SHA.'
    };
  }

  const pullRequest = await upsertPullRequest({
    repoId,
    prNumber: data.prNumber,
    title: data.prTitle,
    author: data.prAuthor,
    headSha: data.headSha,
    status: 'processing'
  });

  await setPullRequestStatus(pullRequest.id, 'processing');

  try {
    const token = await getInstallationToken(data.installationId);
    const rawDiff = await fetchPullRequestDiff({
      token,
      owner: data.repoOwner,
      repo: data.repoName,
      prNumber: data.prNumber
    });

    const diffResult = filterAndLimitDiff(rawDiff, config.MAX_DIFF_CHARS, {
      ignoredPatterns: data.ignoredPatterns ?? []
    });
    if (!diffResult.diff.trim()) {
      throw new Error('No reviewable diff remained after filtering generated/binary files.');
    }

    const llmResult = await reviewDiffWithLlm({
      prTitle: data.prTitle,
      prBody: data.prBody,
      diff: diffResult.diff,
      changedFiles: diffResult.changedFiles,
      truncated: diffResult.truncated,
      skippedFiles: diffResult.skippedFiles,
      maxComments: data.maxReviewComments,
      reviewTone: data.reviewTone
    });

    await saveReview({
      prId: pullRequest.id,
      review: llmResult.review,
      llmProvider: config.LLM_PROVIDER,
      llmModel: llmResult.model,
      promptTokens: llmResult.promptTokens,
      completionTokens: llmResult.completionTokens,
      rawResponse: llmResult.rawResponse
    });

    const commentBody = formatSummaryComment(llmResult.review, {
      headSha: data.headSha,
      truncated: diffResult.truncated,
      skippedFiles: diffResult.skippedFiles
    });

    const previousCommentId = await findLatestSummaryCommentId(repoId, data.prNumber);
    const summaryComment = await upsertPrSummaryComment({
      token,
      owner: data.repoOwner,
      repo: data.repoName,
      prNumber: data.prNumber,
      previousCommentId,
      body: commentBody
    });

    await setSummaryCommentId(pullRequest.id, summaryComment.id);

    return {
      skipped: false,
      prId: pullRequest.id,
      reviewModel: llmResult.model,
      githubCommentId: summaryComment.id,
      githubCommentUpdated: summaryComment.updated
    };
  } catch (error) {
    await setPullRequestFailure(pullRequest.id, error);
    throw error;
  }
}

async function upsertPrSummaryComment(input: {
  token: string;
  owner: string;
  repo: string;
  prNumber: number;
  previousCommentId: number | null;
  body: string;
}) {
  if (input.previousCommentId) {
    try {
      const updatedComment = await updatePrSummaryComment({
        token: input.token,
        owner: input.owner,
        repo: input.repo,
        commentId: input.previousCommentId,
        body: input.body
      });

      return { id: updatedComment.id, updated: true };
    } catch (error) {
      console.warn(`Could not update previous PR summary comment ${input.previousCommentId}; posting a new one instead.`, error);
    }
  }

  const postedComment = await postPrSummaryComment({
    token: input.token,
    owner: input.owner,
    repo: input.repo,
    prNumber: input.prNumber,
    body: input.body
  });

  return { id: postedComment.id, updated: false };
}
