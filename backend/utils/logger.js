/**
 * Conditional logging utility
 * Only logs in development or when DEBUG=true
 */
const isDebug = process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development';

export const logger = {
  log: (...args) => {
    if (isDebug) {
      console.log(...args);
    }
  },
  error: (...args) => {
    // Always log errors
    console.error(...args);
  },
  warn: (...args) => {
    // Always log warnings
    console.warn(...args);
  },
  info: (...args) => {
    if (isDebug) {
      console.log(...args);
    }
  },
  debug: (...args) => {
    if (isDebug) {
      console.log('[DEBUG]', ...args);
    }
  }
};

