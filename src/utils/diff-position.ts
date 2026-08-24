import type { ReviewComment } from '../types/index.js';

export interface InlineReviewComment {
  path: string;
  line: number;
  side: 'RIGHT';
  body: string;
}

export function mapCommentsToInlineReview(rawDiff: string, comments: ReviewComment[]) {
  const reviewableLines = collectReviewableNewLines(rawDiff);
  const inlineComments: InlineReviewComment[] = [];
  const fallbackComments: ReviewComment[] = [];
  const seenLocations = new Set<string>();

  for (const comment of comments) {
    if (!comment.line || comment.severity === 'praise') {
      fallbackComments.push(comment);
      continue;
    }

    const fileLines = reviewableLines.get(comment.file);
    const locationKey = `${comment.file}:${comment.line}:${comment.comment}`;
    if (!fileLines?.has(comment.line) || seenLocations.has(locationKey)) {
      fallbackComments.push(comment);
      continue;
    }

    seenLocations.add(locationKey);
    inlineComments.push({
      path: comment.file,
      line: comment.line,
      side: 'RIGHT',
      body: formatInlineBody(comment)
    });
  }

  return { inlineComments, fallbackComments };
}

function collectReviewableNewLines(rawDiff: string) {
  const files = new Map<string, Set<number>>();
  const fileBlocks = rawDiff.split(/^diff --git /m);

  for (const block of fileBlocks) {
    if (!block.trim()) continue;
    const normalizedBlock = block.startsWith('a/') ? `diff --git ${block}` : block;
    const pathMatch = normalizedBlock.match(/^diff --git a\/(.+?) b\/(.+)$/m);
    const filePath = pathMatch?.[2];
    if (!filePath) continue;

    const lines = normalizedBlock.split('\n');
    const reviewableLines = new Set<number>();
    let newLine: number | null = null;

    for (const line of lines) {
      const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (hunkMatch) {
        newLine = Number(hunkMatch[1]);
        continue;
      }

      if (newLine === null) continue;
      if (line.startsWith('+++') || line.startsWith('---')) continue;

      if (line.startsWith('+')) {
        reviewableLines.add(newLine);
        newLine += 1;
        continue;
      }

      if (line.startsWith(' ')) {
        reviewableLines.add(newLine);
        newLine += 1;
        continue;
      }
    }

    if (reviewableLines.size > 0) {
      files.set(filePath, reviewableLines);
    }
  }

  return files;
}

function formatInlineBody(comment: ReviewComment) {
  const label = comment.severity[0].toUpperCase() + comment.severity.slice(1);
  return `**${label}:** ${comment.comment}`;
}
