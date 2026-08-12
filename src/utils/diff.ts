const ignoredPathPatterns = [
  /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$/i,
  /(^|\/)(dist|build|coverage)\//i,
  /\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|mp4|mov)$/i
];

export function isIgnoredPath(path: string) {
  return ignoredPathPatterns.some((pattern) => pattern.test(path));
}

export function filterAndLimitDiff(rawDiff: string, maxChars: number) {
  const fileBlocks = rawDiff.split(/^diff --git /m);
  const keptBlocks: string[] = [];
  const skippedFiles: string[] = [];
  const changedFiles: string[] = [];

  for (const block of fileBlocks) {
    if (!block.trim()) continue;
    const normalizedBlock = block.startsWith('a/') ? `diff --git ${block}` : block;
    const pathMatch = normalizedBlock.match(/^diff --git a\/(.+?) b\/(.+)$/m);
    const filePath = pathMatch?.[2] ?? '';

    if (filePath && isIgnoredPath(filePath)) {
      skippedFiles.push(filePath);
      continue;
    }

    if (filePath) {
      changedFiles.push(filePath);
    }

    keptBlocks.push(normalizedBlock);
  }

  const filteredDiff = keptBlocks.join('\n');
  if (filteredDiff.length <= maxChars) {
    return { diff: filteredDiff, truncated: false, skippedFiles, changedFiles };
  }

  return {
    diff: filteredDiff.slice(0, maxChars),
    truncated: true,
    skippedFiles,
    changedFiles
  };
}
