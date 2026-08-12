import { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';
import type { ReviewComment, StructuredReview } from '../types/index.js';

export async function recordWebhookEvent(input: {
  deliveryId: string;
  eventName: string;
  action?: string;
  repoFullName?: string;
  prNumber?: number;
}) {
  await prisma.webhookEvent.upsert({
    where: { deliveryId: input.deliveryId },
    create: {
      deliveryId: input.deliveryId,
      eventName: input.eventName,
      action: input.action ?? null,
      repoFullName: input.repoFullName ?? null,
      prNumber: input.prNumber ?? null
    },
    update: {}
  });
}

export async function upsertRepository(input: {
  githubId: number;
  owner: string;
  name: string;
  fullName: string;
}) {
  const repository = await prisma.repository.upsert({
    where: { githubId: BigInt(input.githubId) },
    create: {
      githubId: BigInt(input.githubId),
      owner: input.owner,
      name: input.name,
      fullName: input.fullName
    },
    update: {
      owner: input.owner,
      name: input.name,
      fullName: input.fullName
    },
    select: { id: true }
  });

  return repository.id;
}

export async function upsertPullRequest(input: {
  repoId: number;
  prNumber: number;
  title: string;
  author: string;
  headSha: string;
  status: string;
}) {
  const existing = await prisma.pullRequest.findUnique({
    where: {
      repoId_prNumber_headSha: {
        repoId: input.repoId,
        prNumber: input.prNumber,
        headSha: input.headSha
      }
    },
    select: { id: true, status: true }
  });

  if (existing) {
    const pullRequest = await prisma.pullRequest.update({
      where: { id: existing.id },
      data: {
        prTitle: input.title,
        prAuthor: input.author,
        status: existing.status === 'done' ? existing.status : input.status,
        failureMessage: null,
        failedAt: null,
        updatedAt: new Date()
      },
      select: { id: true, status: true }
    });

    return pullRequest;
  }

  return prisma.pullRequest.create({
    data: {
      repoId: input.repoId,
      prNumber: input.prNumber,
      prTitle: input.title,
      prAuthor: input.author,
      headSha: input.headSha,
      status: input.status
    },
    select: { id: true, status: true }
  });
}

export async function findCompletedPullRequest(repoId: number, prNumber: number, headSha: string) {
  return prisma.pullRequest.findFirst({
    where: {
      repoId,
      prNumber,
      headSha,
      status: 'done'
    },
    select: {
      id: true,
      githubSummaryCommentId: true
    }
  });
}

export async function setPullRequestStatus(prId: number, status: 'pending' | 'processing' | 'done' | 'failed') {
  await prisma.pullRequest.update({
    where: { id: prId },
    data: {
      status,
      failureMessage: status === 'failed' ? undefined : null,
      failedAt: status === 'failed' ? undefined : null,
      updatedAt: new Date()
    }
  });
}

export async function setPullRequestFailure(prId: number, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  await prisma.pullRequest.update({
    where: { id: prId },
    data: {
      status: 'failed',
      failureMessage: message.slice(0, 4000),
      failedAt: new Date(),
      updatedAt: new Date()
    }
  });
}

export async function saveReview(input: {
  prId: number;
  review: StructuredReview;
  llmProvider: string;
  llmModel: string;
  promptTokens?: number | null;
  completionTokens?: number | null;
  rawResponse: unknown;
}) {
  const review = await prisma.review.create({
    data: {
      prId: input.prId,
      overallScore: input.review.overall_score,
      summary: input.review.summary,
      llmProvider: input.llmProvider,
      llmModel: input.llmModel,
      promptTokens: input.promptTokens ?? null,
      completionTokens: input.completionTokens ?? null,
      rawResponse: input.rawResponse as Prisma.InputJsonValue,
      comments: {
        create: input.review.comments.map(toReviewCommentCreate)
      }
    },
    select: { id: true }
  });

  return review.id;
}

function toReviewCommentCreate(comment: ReviewComment) {
  return {
    filePath: comment.file,
    lineNumber: comment.line ?? null,
    severity: comment.severity,
    comment: comment.comment
  };
}

export async function setSummaryCommentId(prId: number, commentId: number) {
  await prisma.pullRequest.update({
    where: { id: prId },
    data: {
      githubSummaryCommentId: BigInt(commentId),
      status: 'done',
      updatedAt: new Date()
    }
  });
}

export async function findLatestSummaryCommentId(repoId: number, prNumber: number) {
  const pullRequest = await prisma.pullRequest.findFirst({
    where: {
      repoId,
      prNumber,
      githubSummaryCommentId: { not: null }
    },
    orderBy: { updatedAt: 'desc' },
    select: { githubSummaryCommentId: true }
  });

  return pullRequest?.githubSummaryCommentId ? Number(pullRequest.githubSummaryCommentId) : null;
}

export async function listRecentReviews(limit = 50) {
  const reviews = await prisma.review.findMany({
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: {
      pullRequest: {
        include: {
          repository: true
        }
      }
    }
  });

  return reviews.map((review) => ({
    id: review.id,
    overall_score: review.overallScore,
    summary: review.summary,
    llm_provider: review.llmProvider,
    llm_model: review.llmModel,
    created_at: review.createdAt,
    pr_number: review.pullRequest?.prNumber,
    pr_title: review.pullRequest?.prTitle,
    pr_author: review.pullRequest?.prAuthor,
    head_sha: review.pullRequest?.headSha,
    status: review.pullRequest?.status,
    failure_message: review.pullRequest?.failureMessage,
    failed_at: review.pullRequest?.failedAt,
    github_summary_comment_id: review.pullRequest?.githubSummaryCommentId?.toString() ?? null,
    repo_full_name: review.pullRequest?.repository?.fullName
  }));
}

export async function getReviewDetail(reviewId: number) {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: {
      comments: {
        orderBy: { id: 'asc' }
      },
      pullRequest: {
        include: {
          repository: true
        }
      }
    }
  });

  if (!review) return null;

  return {
    id: review.id,
    pr_id: review.prId,
    overall_score: review.overallScore,
    summary: review.summary,
    llm_provider: review.llmProvider,
    llm_model: review.llmModel,
    prompt_tokens: review.promptTokens,
    completion_tokens: review.completionTokens,
    raw_response: review.rawResponse,
    created_at: review.createdAt,
    pr_number: review.pullRequest?.prNumber,
    pr_title: review.pullRequest?.prTitle,
    pr_author: review.pullRequest?.prAuthor,
    head_sha: review.pullRequest?.headSha,
    status: review.pullRequest?.status,
    failure_message: review.pullRequest?.failureMessage,
    failed_at: review.pullRequest?.failedAt,
    github_summary_comment_id: review.pullRequest?.githubSummaryCommentId?.toString() ?? null,
    repo_full_name: review.pullRequest?.repository?.fullName,
    comments: review.comments.map((comment) => ({
      file_path: comment.filePath,
      line_number: comment.lineNumber,
      severity: comment.severity,
      comment: comment.comment,
      created_at: comment.createdAt
    }))
  };
}
