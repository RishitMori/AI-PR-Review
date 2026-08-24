export type ReviewSeverity = 'critical' | 'warning' | 'suggestion' | 'praise';

export interface ReviewComment {
  file: string;
  line?: number | null;
  severity: ReviewSeverity;
  comment: string;
}

export interface StructuredReview {
  overall_score: number;
  summary: string;
  comments: ReviewComment[];
}

export interface ReviewJobData {
  deliveryId: string;
  installationId: number;
  repoOwner: string;
  repoName: string;
  repoFullName: string;
  repoGithubId: number;
  prNumber: number;
  prTitle: string;
  prBody: string;
  prAuthor: string;
  headSha: string;
  reviewTone?: 'light' | 'balanced' | 'strict';
  maxReviewComments?: number;
  maxInlineReviewComments?: number;
  maxInlineCommentsPerFile?: number;
  ignoredPatterns?: string[];
}

export interface AuthUser {
  userId: number;
  githubId: string;
  username: string;
  avatarUrl?: string | null;
  role: 'owner' | 'viewer';
}
