import type { ReviewJobData } from '../types/index.js';

export function reviewJobId(data: Pick<ReviewJobData, 'repoFullName' | 'prNumber' | 'headSha'>) {
  return `${data.repoFullName}#${data.prNumber}#${data.headSha}`;
}
