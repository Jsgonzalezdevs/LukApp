/**
 * Centralized logging for production and development.
 * In production, only errors are logged. In development, all levels are logged.
 */

const isDev = import.meta.env.DEV;

/**
 * Logger interface for consistent logging across the app.
 */
export const logger = {
  /**
   * Debug level - only in development
   */
  debug: (...args: any[]) => {
    if (isDev) {
      console.debug('[DEBUG]', ...args);
    }
  },

  /**
   * Info level - only in development
   */
  info: (...args: any[]) => {
    if (isDev) {
      console.info('[INFO]', ...args);
    }
  },

  /**
   * Warning level - only in development
   */
  warn: (...args: any[]) => {
    if (isDev) {
      console.warn('[WARN]', ...args);
    }
  },

  /**
   * Error level - always logged, even in production
   */
  error: (...args: any[]) => {
    console.error('[ERROR]', ...args);
  },

  /**
   * Group logs together (only in dev)
   */
  group: (label: string) => {
    if (isDev) {
      console.group(label);
    }
  },

  /**
   * End log group
   */
  groupEnd: () => {
    if (isDev) {
      console.groupEnd();
    }
  },

  /**
   * Performance timing (only in dev)
   */
  time: (label: string) => {
    if (isDev) {
      console.time(label);
    }
  },

  /**
   * End performance timing
   */
  timeEnd: (label: string) => {
    if (isDev) {
      console.timeEnd(label);
    }
  },
};
