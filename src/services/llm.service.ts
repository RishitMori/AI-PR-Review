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

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
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
  maxComments?: number;
  reviewTone?: 'light' | 'balanced' | 'strict';
}) {
  await enforceFreeTierLimits();

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: buildSystemPrompt(input)
    },
    {
      role: 'user',
      content: buildUserPrompt(input)
    }
  ];

  const rawResponse = await requestOpenRouter(messages);
  const content = extractResponseContent(rawResponse);
  let review = tryParseReviewJson(content, input.changedFiles);

  if (!review) {
    const repairResponse = await requestOpenRouter([
      ...messages,
      { role: 'assistant', content },
      {
        role: 'user',
        content:
          'The previous response was not valid JSON. Convert it to ONLY valid JSON with the required shape. Do not include markdown, explanation, or text outside the JSON object.'
      }
    ]);
    const repairContent = extractResponseContent(repairResponse);
    review = tryParseReviewJson(repairContent, input.changedFiles);

    if (!review) {
      throw new Error(`LLM response could not be parsed as valid review JSON. First response started with: ${content.slice(0, 200)}`);
    }

    return {
      review,
      model: repairResponse.model ?? rawResponse.model ?? config.OPENROUTER_MODEL,
      promptTokens: (rawResponse.usage?.prompt_tokens ?? 0) + (repairResponse.usage?.prompt_tokens ?? 0),
      completionTokens: (rawResponse.usage?.completion_tokens ?? 0) + (repairResponse.usage?.completion_tokens ?? 0),
      rawResponse: repairResponse
    } satisfies LlmReviewResult;
  }

  return {
    review,
    model: rawResponse.model ?? config.OPENROUTER_MODEL,
    promptTokens: rawResponse.usage?.prompt_tokens,
    completionTokens: rawResponse.usage?.completion_tokens,
    rawResponse
  } satisfies LlmReviewResult;
}

async function requestOpenRouter(messages: ChatMessage[]) {
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
      messages
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenRouter request failed (${response.status}): ${body}`);
  }

  return (await response.json()) as OpenRouterResponse;
}

function extractResponseContent(rawResponse: OpenRouterResponse) {
  const content = rawResponse.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenRouter returned an empty review response.');
  }

  return content;
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

function buildSystemPrompt(input: { maxComments?: number; reviewTone?: 'light' | 'balanced' | 'strict' }) {
  const maxComments = Math.min(Math.max(input.maxComments ?? config.MAX_REVIEW_COMMENTS, 1), 20);
  const toneInstruction = {
    light: 'Use a light review tone. Only flag clear correctness, security, or reliability risks.',
    balanced: 'Use a balanced review tone. Flag important bugs, security risks, and useful maintainability improvements.',
    strict: 'Use a strict review tone. Be more detailed, but still only comment when the diff clearly supports the issue.'
  }[input.reviewTone ?? 'balanced'];

  return [
    'You are reviewing a pull request as a helpful senior engineer.',
    toneInstruction,
    'Only review the code changed in the provided git diff. Do not comment on files, functions, dependencies, or architecture that are not touched by this diff.',
    'Only make actionable suggestions when they are clearly supported by added or modified lines in the diff.',
    'Do not give generic advice. Do not ask for unrelated tests, refactors, formatting, or style changes unless the changed lines introduce that specific problem.',
    'If there are no concrete issues in the changed code, return an empty comments array and a short positive summary.',
    `Return at most ${maxComments} comments.`,
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

function tryParseReviewJson(content: string, changedFiles: string[]): StructuredReview | null {
  for (const candidate of getJsonCandidates(content)) {
    try {
      return normalizeReviewJson(JSON.parse(candidate) as Partial<StructuredReview>, changedFiles);
    } catch {
      // Try the next candidate.
    }
  }

  return null;
}

function getJsonCandidates(content: string) {
  const trimmed = content.trim();
  const candidates = [trimmed];

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    candidates.push(fencedMatch[1].trim());
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  return [...new Set(candidates)];
}

function normalizeReviewJson(parsed: Partial<StructuredReview>, changedFiles: string[]): StructuredReview {
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
