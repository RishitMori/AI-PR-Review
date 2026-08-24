import { prisma } from './prisma.js';
import type { ReviewComment, StructuredReview } from '../types/index.js';

const defaultRepositorySettings = {
  enabled: true,
  reviewOnOpened: true,
  reviewOnSynchronize: true,
  reviewOnReopened: true,
  maxComments: 6,
  maxInlineComments: 2,
  maxInlineCommentsPerFile: 1,
  reviewTone: 'balanced',
  ignoredPatterns: ''
};

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

export async function upsertGitHubInstallation(input: {
  githubInstallationId: number;
  accountGithubId?: number | null;
  accountLogin?: string | null;
  accountType?: string | null;
}) {
  const updateData: any = {
    suspendedAt: null,
    updatedAt: new Date()
  };
  if (input.accountGithubId !== undefined) {
    updateData.accountGithubId = input.accountGithubId ? BigInt(input.accountGithubId) : null;
  }
  if (input.accountLogin !== undefined) {
    updateData.accountLogin = input.accountLogin;
  }
  if (input.accountType !== undefined) {
    updateData.accountType = input.accountType;
  }

  return prisma.gitHubInstallation.upsert({
    where: { githubInstallationId: BigInt(input.githubInstallationId) },
    create: {
      githubInstallationId: BigInt(input.githubInstallationId),
      accountGithubId: input.accountGithubId ? BigInt(input.accountGithubId) : null,
      accountLogin: input.accountLogin ?? null,
      accountType: input.accountType ?? null
    },
    update: updateData,
    select: { id: true }
  });
}

export async function linkUserInstallation(userId: number, installationId: number) {
  await prisma.userInstallation.upsert({
    where: {
      userId_installationId: {
        userId,
        installationId
      }
    },
    create: {
      userId,
      installationId
    },
    update: {
      lastSeenAt: new Date()
    }
  });
}

export async function replaceUserInstallations(userId: number, installationIds: number[]) {
  await prisma.userInstallation.deleteMany({
    where: {
      userId,
      installationId: {
        notIn: installationIds.length > 0 ? installationIds : [-1]
      }
    }
  });
}

export async function markInstallationSuspended(githubInstallationId: number) {
  await prisma.gitHubInstallation.updateMany({
    where: { githubInstallationId: BigInt(githubInstallationId) },
    data: {
      suspendedAt: new Date(),
      updatedAt: new Date()
    }
  });
}

export async function upsertRepository(input: {
  githubId: number;
  githubInstallationId?: number | null;
  owner: string;
  name: string;
  fullName: string;
}) {
  const installation = input.githubInstallationId
    ? await upsertGitHubInstallation({ githubInstallationId: input.githubInstallationId })
    : null;
  const repository = await prisma.repository.upsert({
    where: { githubId: BigInt(input.githubId) },
    create: {
      githubId: BigInt(input.githubId),
      installationId: installation?.id ?? null,
      owner: input.owner,
      name: input.name,
      fullName: input.fullName
    },
    update: {
      installationId: installation?.id ?? undefined,
      owner: input.owner,
      name: input.name,
      fullName: input.fullName
    },
    select: { id: true }
  });

  await prisma.repositorySettings.upsert({
    where: { repoId: repository.id },
    create: {
      repoId: repository.id,
      ...defaultRepositorySettings
    },
    update: {}
  });

  return repository.id;
}

export async function getRepositorySettings(repoId: number) {
  return prisma.repositorySettings.upsert({
    where: { repoId },
    create: {
      repoId,
      ...defaultRepositorySettings
    },
    update: {}
  });
}

export async function updateRepositorySettings(
  repoId: number,
  actor: { userId: number; username: string },
  input: {
    enabled: boolean;
    reviewOnOpened: boolean;
    reviewOnSynchronize: boolean;
    reviewOnReopened: boolean;
    maxComments: number;
    maxInlineComments: number;
    maxInlineCommentsPerFile: number;
    reviewTone: 'light' | 'balanced' | 'strict';
    ignoredPatterns: string;
  }
) {
  const repository = await prisma.repository.findFirst({
    where: {
      id: repoId,
      ...repositoryAccessWhere(actor)
    },
    select: { id: true }
  });

  if (!repository) return null;

  return prisma.repositorySettings.upsert({
    where: { repoId },
    create: {
      repoId,
      ...input
    },
    update: {
      ...input,
      updatedAt: new Date()
    }
  });
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
      rawResponse: input.rawResponse as never,
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

export async function listRecentReviews(actor: { userId: number; username: string }, limit = 50) {
  const reviews = await prisma.review.findMany({
    take: limit,
    orderBy: { createdAt: 'desc' },
    where: {
      pullRequest: {
        repository: repositoryAccessWhere(actor)
      }
    },
    include: {
      pullRequest: {
        include: {
          repository: true
        }
      }
    }
  });

  return reviews.map((review: any) => ({
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

export async function listRepositories(actor: { userId: number; username: string }) {
  const repositories = await prisma.repository.findMany({
    where: repositoryAccessWhere(actor),
    orderBy: { installedAt: 'desc' },
    include: {
      settings: true,
      pullRequests: {
        select: {
          id: true,
          status: true,
          reviews: {
            select: { id: true }
          }
        }
      }
    }
  });

  return repositories.map((repository: any) => ({
    id: repository.id,
    github_id: repository.githubId.toString(),
    owner: repository.owner,
    name: repository.name,
    full_name: repository.fullName,
    installed_at: repository.installedAt,
    pull_request_count: repository.pullRequests.length,
    review_count: repository.pullRequests.reduce((total: number, pr: any) => total + pr.reviews.length, 0),
    failed_count: repository.pullRequests.filter((pr: any) => pr.status === 'failed').length,
    settings: toRepositorySettingsDto(repository.settings)
  }));
}

function toRepositorySettingsDto(settings: any) {
  const resolved = settings ?? defaultRepositorySettings;
  return {
    enabled: resolved.enabled,
    review_on_opened: resolved.reviewOnOpened,
    review_on_synchronize: resolved.reviewOnSynchronize,
    review_on_reopened: resolved.reviewOnReopened,
    max_comments: resolved.maxComments,
    max_inline_comments: resolved.maxInlineComments,
    max_inline_comments_per_file: resolved.maxInlineCommentsPerFile,
    review_tone: resolved.reviewTone,
    ignored_patterns: resolved.ignoredPatterns
  };
}

export async function getStats(actor: { userId: number; username: string }) {
  const [reviewCount, repositoryCount, pullRequestCount, failedCount, reviews] = await Promise.all([
    prisma.review.count({
      where: {
        pullRequest: {
          repository: repositoryAccessWhere(actor)
        }
      }
    }),
    prisma.repository.count({ where: repositoryAccessWhere(actor) }),
    prisma.pullRequest.count({
      where: {
        repository: repositoryAccessWhere(actor)
      }
    }),
    prisma.pullRequest.count({
      where: {
        status: 'failed',
        repository: repositoryAccessWhere(actor)
      }
    }),
    prisma.review.findMany({
      where: {
        pullRequest: {
          repository: repositoryAccessWhere(actor)
        }
      },
      select: { overallScore: true, createdAt: true }
    })
  ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const scores = reviews.map((review: any) => review.overallScore).filter((score: unknown): score is number => typeof score === 'number');
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((sum: number, score: number) => sum + score, 0) / scores.length) : null;
  const reviewsToday = reviews.filter((review: any) => review.createdAt && review.createdAt >= today).length;

  return {
    review_count: reviewCount,
    repository_count: repositoryCount,
    pull_request_count: pullRequestCount,
    failed_count: failedCount,
    average_score: avgScore,
    reviews_today: reviewsToday
  };
}

export async function getReviewDetail(actor: { userId: number; username: string }, reviewId: number) {
  const review = await prisma.review.findFirst({
    where: {
      id: reviewId,
      pullRequest: {
        repository: repositoryAccessWhere(actor)
      }
    },
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
    comments: review.comments.map((comment: any) => ({
      file_path: comment.filePath,
      line_number: comment.lineNumber,
      severity: comment.severity,
      comment: comment.comment,
      created_at: comment.createdAt
    }))
  };
}

function repositoryAccessWhere(actor: { userId: number; username: string }) {
  return {
    OR: [
      {
        installation: {
          is: {
            users: {
              some: { userId: actor.userId }
            },
            suspendedAt: null
          }
        }
      },
      {
        installationId: null,
        owner: {
          equals: actor.username
        }
      }
    ]
  } as any;
}
