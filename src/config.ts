import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const baseEnvSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.string().default('development'),
  LOG_LEVEL: z.enum(['silent', 'error', 'warn', 'info', 'debug']).default('info'),
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  GITHUB_APP_ID: z.string().default(''),
  GITHUB_PRIVATE_KEY: z.string().default(''),
  GITHUB_WEBHOOK_SECRET: z.string().default(''),
  GITHUB_CLIENT_ID: z.string().default(''),
  GITHUB_CLIENT_SECRET: z.string().default(''),
  GITHUB_CALLBACK_URL: z.string().url().default('http://localhost:3000/auth/github/callback'),
  GITHUB_APP_SLUG: z.string().default(''),
  LLM_PROVIDER: z.literal('openrouter').default('openrouter'),
  OPENROUTER_API_KEY: z.string().default(''),
  OPENROUTER_MODEL: z.string().min(1).default('openrouter/free'),
  OPENROUTER_FALLBACK_MODELS: z.string().default(''),
  OPENROUTER_MAX_TOKENS: z.coerce.number().int().positive().default(900),
  OPENROUTER_SITE_URL: z.string().url().default('http://localhost:3000'),
  OPENROUTER_APP_NAME: z.string().default('AI PR Review Bot'),
  MAX_DIFF_CHARS: z.coerce.number().int().positive().default(25000),
  MAX_REVIEW_COMMENTS: z.coerce.number().int().positive().default(6),
  LLM_DAILY_LIMIT: z.coerce.number().int().positive().default(40),
  LLM_MINUTE_LIMIT: z.coerce.number().int().positive().default(5),
  JWT_SECRET: z.string().default(''),
  JWT_EXPIRY_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 7),
  SESSION_REFRESH_INTERVAL_SECONDS: z.coerce.number().int().positive().default(60 * 5),
  COOKIE_SECURE: z.coerce.boolean().default(false),
  RAZORPAY_PAYMENT_LINK_URL: z.string().url().or(z.literal('')).default(''),
  RAZORPAY_CUSTOMER_PORTAL_URL: z.string().url().or(z.literal('')).default('')
});

export const config = baseEnvSchema.parse(process.env);

export const githubPrivateKey = normalizePrivateKey(config.GITHUB_PRIVATE_KEY);

export const fallbackModels = config.OPENROUTER_FALLBACK_MODELS.split(',')
  .map((model) => model.trim())
  .filter(Boolean);

export function assertRuntimeConfig() {
  const runtimeSchema = z.object({
    GITHUB_APP_ID: z.string().min(1, 'GITHUB_APP_ID is required'),
    GITHUB_PRIVATE_KEY: z.string().min(1, 'GITHUB_PRIVATE_KEY is required'),
    GITHUB_WEBHOOK_SECRET: z.string().min(1, 'GITHUB_WEBHOOK_SECRET is required'),
    GITHUB_CLIENT_ID: z.string().min(1, 'GITHUB_CLIENT_ID is required'),
    GITHUB_CLIENT_SECRET: z.string().min(1, 'GITHUB_CLIENT_SECRET is required'),
    OPENROUTER_API_KEY: z.string().min(1, 'OPENROUTER_API_KEY is required'),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters')
  });

  runtimeSchema.parse(config);
}

function normalizePrivateKey(value: string) {
  return value
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/\\n/g, '\n');
}
