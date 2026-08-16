const ignoredPathPatterns = [
  /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$/i,
  /(^|\/)(dist|build|coverage)\//i,
  /\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|mp4|mov)$/i
];

export function isIgnoredPath(path: string, customPatterns: string[] = []) {
  return ignoredPathPatterns.some((pattern) => pattern.test(path)) || customPatterns.some((pattern) => matchesSimplePattern(path, pattern));
}

export function filterAndLimitDiff(rawDiff: string, maxChars: number, options: { ignoredPatterns?: string[] } = {}) {
  const fileBlocks = rawDiff.split(/^diff --git /m);
  const keptBlocks: string[] = [];
  const skippedFiles: string[] = [];
  const changedFiles: string[] = [];
  const customPatterns = options.ignoredPatterns ?? [];

  for (const block of fileBlocks) {
    if (!block.trim()) continue;
    const normalizedBlock = block.startsWith('a/') ? `diff --git ${block}` : block;
    const pathMatch = normalizedBlock.match(/^diff --git a\/(.+?) b\/(.+)$/m);
    const filePath = pathMatch?.[2] ?? '';

    if (filePath && isIgnoredPath(filePath, customPatterns)) {
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

function matchesSimplePattern(path: string, pattern: string) {
  const normalizedPath = path.replace(/\\/g, '/');
  const normalizedPattern = pattern.replace(/\\/g, '/').trim();
  if (!normalizedPattern) return false;
  if (!normalizedPattern.includes('*')) {
    return normalizedPath === normalizedPattern || normalizedPath.startsWith(`${normalizedPattern.replace(/\/$/, '')}/`);
  }

  const escaped = normalizedPattern
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${escaped}$`, 'i').test(normalizedPath);
}
