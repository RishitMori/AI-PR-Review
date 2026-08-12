import type { StructuredReview } from '../types/index.js';

export function formatSummaryComment(
  review: StructuredReview,
  meta: { headSha: string; truncated: boolean; skippedFiles: string[] }
) {
  const shortSha = meta.headSha.slice(0, 7);
  const lines = [
    `<!-- ai-pr-review-bot reviewed-sha:${shortSha} -->`,
    '## Review notes',
    '',
    `I reviewed the latest changes in \`${shortSha}\`. ${review.summary}`,
    ''
  ];

  if (review.comments.length > 0) {
    lines.push('A few things I would change:', '');
    for (const comment of review.comments) {
      const location = comment.line ? `${comment.file}:${comment.line}` : comment.file;
      lines.push(`- \`${location}\` - ${comment.comment}`);
    }
    lines.push('');
  } else {
    lines.push('No changes requested from my side.', '');
  }

  if (meta.truncated || meta.skippedFiles.length > 0) {
    lines.push('<sub>');
    const notes: string[] = [];
    if (meta.truncated) notes.push('Large diff was shortened before review.');
    if (meta.skippedFiles.length > 0) notes.push(`Skipped generated or binary files: ${meta.skippedFiles.join(', ')}.`);
    lines.push(notes.join(' '));
    lines.push('</sub>');
    lines.push('');
  }
  return lines.join('\n');
}
