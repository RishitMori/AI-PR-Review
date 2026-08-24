import type { StructuredReview } from '../types/index.js';

export function formatSummaryComment(
  review: StructuredReview,
  meta: { headSha: string; truncated: boolean; skippedFiles: string[]; reviewedFiles?: string[]; inlineCommentCount?: number }
) {
  const shortSha = meta.headSha.slice(0, 7);
  const groupedComments = groupCommentsBySeverity(review.comments);
  const totalFindings = review.comments.length;
  const inlineCommentCount = meta.inlineCommentCount ?? 0;
  const lines = [
    `<!-- ai-pr-review-bot reviewed-sha:${shortSha} -->`,
    '## ReviewPilot walkthrough',
    '',
    `I reviewed the latest changes in \`${shortSha}\`. ${review.summary}`,
    '',
    '### Review status',
    '',
    `| Score | Findings | Inline comments |`,
    `| --- | ---: | ---: |`,
    `| ${review.overall_score}/100 | ${totalFindings} | ${inlineCommentCount} |`,
    ''
  ];

  if (totalFindings > 0) {
    lines.push('### Findings');
    lines.push('');

    for (const severity of ['critical', 'warning', 'suggestion', 'praise'] as const) {
      const comments = groupedComments[severity];
      if (comments.length === 0) continue;

      lines.push(`<details${severity === 'critical' || severity === 'warning' ? ' open' : ''}>`);
      lines.push(`<summary>${formatSeverityLabel(severity)} (${comments.length})</summary>`);
      lines.push('');

      for (const comment of comments) {
        const location = comment.line ? `${comment.file}:${comment.line}` : comment.file;
        lines.push(`- \`${location}\` - ${comment.comment}`);
      }

      lines.push('');
      lines.push('</details>');
      lines.push('');
    }
  } else {
    lines.push('No changes requested from my side.', '');
  }

  if (meta.reviewedFiles && meta.reviewedFiles.length > 0) {
    lines.push('### Files reviewed', '');
    if (meta.reviewedFiles.length <= 8) {
      for (const file of meta.reviewedFiles) {
        lines.push(`- \`${file}\``);
      }
      lines.push('');
    } else {
      lines.push(`<details>`);
      lines.push(`<summary>${meta.reviewedFiles.length} files reviewed</summary>`);
      lines.push('');
      for (const file of meta.reviewedFiles) {
        lines.push(`- \`${file}\``);
      }
      lines.push('');
      lines.push('</details>');
      lines.push('');
    }
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

function groupCommentsBySeverity(comments: StructuredReview['comments']) {
  return comments.reduce(
    (groups, comment) => {
      groups[comment.severity].push(comment);
      return groups;
    },
    {
      critical: [],
      warning: [],
      suggestion: [],
      praise: []
    } as Record<StructuredReview['comments'][number]['severity'], StructuredReview['comments']>
  );
}

function formatSeverityLabel(severity: StructuredReview['comments'][number]['severity']) {
  return {
    critical: 'Critical',
    warning: 'Warnings',
    suggestion: 'Suggestions',
    praise: 'Notes'
  }[severity];
}
