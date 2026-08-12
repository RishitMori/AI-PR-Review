import { config, fallbackModels } from '../config.js';
import { redisConnection } from '../queue/redis.js';
import type { ReviewSeverity, StructuredReview } from '../types/index.js';

interface OpenRouterResponse {
  model?: string;
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

export interface LlmReviewResult {
  review: StructuredReview;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  rawResponse: OpenRouterResponse;
}

export async function reviewDiffWithLlm(input: {
  prTitle: string;
  prBody: string;
  diff: string;
  changedFiles: string[];
  truncated: boolean;
  skippedFiles: string[];
}) {
  await enforceFreeTierLimits();

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': config.OPENROUTER_SITE_URL,
      'X-Title': config.OPENROUTER_APP_NAME
    },
    body: JSON.stringify({
      model: config.OPENROUTER_MODEL,
      models: fallbackModels.length > 0 ? [config.OPENROUTER_MODEL, ...fallbackModels] : undefined,
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: config.OPENROUTER_MAX_TOKENS,
      messages: [
        {
          role: 'system',
          content: buildSystemPrompt()
        },
        {
          role: 'user',
          content: buildUserPrompt(input)
        }
      ]
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenRouter request failed (${response.status}): ${body}`);
  }

  const rawResponse = (await response.json()) as OpenRouterResponse;
  const content = rawResponse.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenRouter returned an empty review response.');
  }

  return {
    review: parseReviewJson(content, input.changedFiles),
    model: rawResponse.model ?? config.OPENROUTER_MODEL,
    promptTokens: rawResponse.usage?.prompt_tokens,
    completionTokens: rawResponse.usage?.completion_tokens,
    rawResponse
  } satisfies LlmReviewResult;
}

async function enforceFreeTierLimits() {
  const dayKey = `llm:usage:day:${new Date().toISOString().slice(0, 10)}`;
  const minuteKey = `llm:usage:minute:${Math.floor(Date.now() / 60000)}`;

  const [dailyCount, minuteCount] = await Promise.all([incrementWithExpiry(dayKey, 60 * 60 * 26), incrementWithExpiry(minuteKey, 90)]);

  if (dailyCount > config.LLM_DAILY_LIMIT) {
    throw new Error(`Local LLM daily limit reached (${config.LLM_DAILY_LIMIT}). Increase LLM_DAILY_LIMIT only if you are okay using more OpenRouter free requests.`);
  }

  if (minuteCount > config.LLM_MINUTE_LIMIT) {
    throw new Error(`Local LLM per-minute limit reached (${config.LLM_MINUTE_LIMIT}). Try again in a minute.`);
  }
}

async function incrementWithExpiry(key: string, ttlSeconds: number) {
  const count = await redisConnection.incr(key);
  if (count === 1) {
    await redisConnection.expire(key, ttlSeconds);
  }

  return count;
}

function buildSystemPrompt() {
  return [
    'You are reviewing a pull request as a helpful senior engineer.',
    'Only review the code changed in the provided git diff. Do not comment on files, functions, dependencies, or architecture that are not touched by this diff.',
    'Only make actionable suggestions when they are clearly supported by added or modified lines in the diff.',
    'Do not give generic advice. Do not ask for unrelated tests, refactors, formatting, or style changes unless the changed lines introduce that specific problem.',
    'If there are no concrete issues in the changed code, return an empty comments array and a short positive summary.',
    `Return at most ${config.MAX_REVIEW_COMMENTS} comments.`,
    'Return ONLY valid JSON with this exact shape:',
    '{"overall_score": number, "summary": string, "comments": [{"file": string, "line": number|null, "severity": "critical|warning|suggestion|praise", "comment": string}]}'
  ].join('\n');
}

function buildUserPrompt(input: {
  prTitle: string;
  prBody: string;
  diff: string;
  changedFiles: string[];
  truncated: boolean;
  skippedFiles: string[];
}) {
  return [
    `PR Title: ${input.prTitle}`,
    `PR Description: ${input.prBody || '(none)'}`,
    input.truncated ? 'Note: The diff was truncated because it exceeded the configured size limit.' : '',
    input.skippedFiles.length > 0 ? `Skipped generated/binary files: ${input.skippedFiles.join(', ')}` : '',
    `Reviewable changed files: ${input.changedFiles.join(', ') || '(none)'}`,
    '',
    'Diff:',
    input.diff
  ]
    .filter(Boolean)
    .join('\n');
}

function parseReviewJson(content: string, changedFiles: string[]): StructuredReview {
  const parsed = JSON.parse(content) as Partial<StructuredReview>;

  if (typeof parsed.overall_score !== 'number' || typeof parsed.summary !== 'string' || !Array.isArray(parsed.comments)) {
    throw new Error('LLM response did not match the expected review JSON shape.');
  }

  const changedFileSet = new Set(changedFiles);
  const comments = parsed.comments
    .filter((comment) => changedFileSet.size === 0 || changedFileSet.has(String(comment.file ?? '')))
    .slice(0, config.MAX_REVIEW_COMMENTS)
    .map((comment) => ({
      file: String(comment.file ?? 'unknown'),
      line: typeof comment.line === 'number' ? comment.line : null,
      severity: normalizeSeverity(comment.severity),
      comment: String(comment.comment ?? '')
    }))
    .filter((comment) => comment.comment.trim().length > 0);

  return {
    overall_score: Math.max(0, Math.min(100, Math.round(parsed.overall_score))),
    summary: parsed.summary,
    comments
  };
}

function normalizeSeverity(value: unknown): ReviewSeverity {
  if (value === 'critical' || value === 'warning' || value === 'suggestion' || value === 'praise') {
    return value;
  }

  return 'suggestion';
}
