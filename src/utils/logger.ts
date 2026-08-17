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
    if (enabled('error')) console.error(...args);
  },
  warn: (...args: unknown[]) => {
    if (enabled('warn')) console.warn(...args);
  },
  info: (...args: unknown[]) => {
    if (enabled('info')) console.log(...args);
  },
  debug: (...args: unknown[]) => {
    if (enabled('debug')) console.debug(...args);
  }
};
