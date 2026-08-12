// Logger utility for development and production
// Only logs in development mode (except errors which always log)

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = {
    /**
     * Log general information (development only)
     */
    log: (...args: unknown[]) => {
        if (isDevelopment) {
            console.log(...args);
        }
    },

    /**
     * Log errors (always logged in all environments)
     */
    error: (...args: unknown[]) => {
        console.error(...args);
    },

    /**
     * Log warnings (development only)
     */
    warn: (...args: unknown[]) => {
        if (isDevelopment) {
            console.warn(...args);
        }
    },

    /**
     * Log info messages (development only)
     */
    info: (...args: unknown[]) => {
        if (isDevelopment) {
            console.info(...args);
        }
    },

    /**
     * Log debug messages (development only)
     */
    debug: (...args: unknown[]) => {
        if (isDevelopment) {
            console.debug(...args);
        }
    },
};
