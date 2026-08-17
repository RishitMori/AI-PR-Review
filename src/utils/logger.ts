import { config } from '../config.js';

const levels = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4
};

function enabled(level: keyof typeof levels) {
  return levels[config.LOG_LEVEL] >= levels[level];
}

export const logger = {
  error: (...args: unknown[]) => {
    if (enabled('error')) console.error(...args.map(toLogSafeValue));
  },
  warn: (...args: unknown[]) => {
    if (enabled('warn')) console.warn(...args.map(toLogSafeValue));
  },
  info: (...args: unknown[]) => {
    if (enabled('info')) console.log(...args.map(toLogSafeValue));
  },
  debug: (...args: unknown[]) => {
    if (enabled('debug')) console.debug(...args.map(toLogSafeValue));
  }
};

function toLogSafeValue(value: unknown) {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message
    };
  }

  if (Buffer.isBuffer(value)) {
    return '[buffer redacted]';
  }

  if (typeof value !== 'object' || value === null) {
    return value;
  }

  return '[object redacted]';
}
