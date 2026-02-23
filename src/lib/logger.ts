/**
 * Structured logging using Pino
 */

import pino from "pino";

const isDevelopment = process.env.NODE_ENV === "development";
const isProduction = process.env.NODE_ENV === "production";

/**
 * Create logger instance
 */
export const logger = pino({
	level: process.env.LOG_LEVEL || (isDevelopment ? "debug" : "info"),
	transport: isDevelopment
		? {
				target: "pino-pretty",
				options: {
					colorize: true,
					translateTime: "HH:MM:ss Z",
					ignore: "pid,hostname",
				},
			}
		: undefined, // Use default JSON output in production
	base: {
		service: "df-middleware",
		env: process.env.NODE_ENV || "development",
	},
	formatters: {
		level: (label) => {
			return { level: label };
		},
	},
	redact: {
		paths: [
			// Redact sensitive data from logs
			"password",
			"secret",
			"token",
			"authorization",
			"apiKey",
			"api_key",
			"access_token",
			"refresh_token",
			"*.password",
			"*.secret",
			"*.token",
			"*.authorization",
			"*.apiKey",
			"*.api_key",
			"*.access_token",
			"*.refresh_token",
		],
		remove: true, // Remove redacted fields entirely
	},
});

/**
 * Create child logger with additional context
 */
export function createChildLogger(bindings: Record<string, unknown>) {
	return logger.child(bindings);
}

/**
 * Log levels
 */
export const logLevels = {
	debug: logger.debug.bind(logger),
	info: logger.info.bind(logger),
	warn: logger.warn.bind(logger),
	error: logger.error.bind(logger),
	fatal: logger.fatal.bind(logger),
} as const;
