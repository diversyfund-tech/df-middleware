/**
 * Custom error classes for standardized error handling
 */

import { ERROR_CODES } from "./constants";

/**
 * Base error class for all application errors
 */
export class AppError extends Error {
	public readonly code: string;
	public readonly statusCode: number;
	public readonly isOperational: boolean;

	constructor(
		message: string,
		code: string = ERROR_CODES.PROXY_ERROR,
		statusCode: number = 500,
		isOperational: boolean = true
	) {
		super(message);
		this.name = this.constructor.name;
		this.code = code;
		this.statusCode = statusCode;
		this.isOperational = isOperational;

		// Maintains proper stack trace for where our error was thrown
		Error.captureStackTrace(this, this.constructor);
	}
}

/**
 * Authentication/Authorization errors
 */
export class AuthError extends AppError {
	constructor(message: string = "Authentication failed", code: string = ERROR_CODES.AUTH_ERROR) {
		super(message, code, 401);
	}
}

/**
 * Validation errors
 */
export class ValidationError extends AppError {
	constructor(message: string = "Validation failed", code: string = ERROR_CODES.VALIDATION_ERROR) {
		super(message, code, 400);
	}
}

/**
 * Sync operation errors
 */
export class SyncError extends AppError {
	public readonly direction?: string;
	public readonly entityType?: string;
	public readonly entityId?: string;

	constructor(
		message: string,
		direction?: string,
		entityType?: string,
		entityId?: string,
		code: string = ERROR_CODES.SYNC_ERROR
	) {
		super(message, code, 500);
		this.direction = direction;
		this.entityType = entityType;
		this.entityId = entityId;
	}
}

/**
 * Webhook processing errors
 */
export class WebhookError extends AppError {
	public readonly source?: string;
	public readonly eventType?: string;

	constructor(
		message: string,
		source?: string,
		eventType?: string,
		code: string = ERROR_CODES.WEBHOOK_ERROR
	) {
		super(message, code, 400);
		this.source = source;
		this.eventType = eventType;
	}
}

/**
 * API client errors (for external API failures)
 */
export class APIError extends AppError {
	public readonly apiName: string;
	public readonly endpoint?: string;
	public readonly statusCode: number;

	constructor(
		message: string,
		apiName: string,
		endpoint?: string,
		statusCode: number = 500
	) {
		super(message, ERROR_CODES.PROXY_ERROR, statusCode);
		this.apiName = apiName;
		this.endpoint = endpoint;
		this.statusCode = statusCode;
	}
}

/**
 * Check if error is an instance of AppError
 */
export function isAppError(error: unknown): error is AppError {
	return error instanceof AppError;
}

/**
 * Convert any error to AppError
 */
export function toAppError(error: unknown): AppError {
	if (isAppError(error)) {
		return error;
	}

	if (error instanceof Error) {
		return new AppError(error.message);
	}

	return new AppError("Unknown error occurred");
}
