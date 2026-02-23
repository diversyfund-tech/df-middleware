/**
 * Error Handler
 * 
 * Standardized error handling with retry logic and circuit breaker pattern.
 */

export interface RetryOptions {
	maxRetries?: number;
	retryDelay?: number; // milliseconds
	exponentialBackoff?: boolean;
	retryableErrors?: string[]; // Error patterns to retry
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
	maxRetries: 3,
	retryDelay: 1000,
	exponentialBackoff: true,
	retryableErrors: ["timeout", "network", "503", "502", "500"],
};

/**
 * Circuit breaker state
 */
interface CircuitBreakerState {
	isOpen: boolean;
	failureCount: number;
	lastFailureTime: number;
	successCount: number;
}

const circuitBreakers = new Map<string, CircuitBreakerState>();

/**
 * Check if error is retryable
 */
function isRetryableError(error: Error, retryableErrors: string[]): boolean {
	const errorMessage = error.message.toLowerCase();
	return retryableErrors.some(pattern => errorMessage.includes(pattern.toLowerCase()));
}

/**
 * Execute function with retry logic
 */
export async function executeWithRetry<T>(
	fn: () => Promise<T>,
	options: RetryOptions = {}
): Promise<T> {
	const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
	let lastError: Error | null = null;

	for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));

			// Check if error is retryable
			if (!isRetryableError(lastError, opts.retryableErrors)) {
				throw lastError;
			}

			// Don't retry on last attempt
			if (attempt === opts.maxRetries) {
				break;
			}

			// Calculate delay
			const delay = opts.exponentialBackoff
				? opts.retryDelay * Math.pow(2, attempt)
				: opts.retryDelay;

			console.log(`[error-handler] Retry attempt ${attempt + 1}/${opts.maxRetries} after ${delay}ms`);
			await new Promise(resolve => setTimeout(resolve, delay));
		}
	}

	throw lastError || new Error("Unknown error");
}

/**
 * Circuit breaker: check if operation should proceed
 */
export function checkCircuitBreaker(serviceName: string): { allowed: boolean; reason?: string } {
	const state = circuitBreakers.get(serviceName) || {
		isOpen: false,
		failureCount: 0,
		lastFailureTime: 0,
		successCount: 0,
	};

	// If circuit is open, check if we should try again (half-open state)
	if (state.isOpen) {
		const timeSinceLastFailure = Date.now() - state.lastFailureTime;
		const cooldownPeriod = 60000; // 60 seconds

		if (timeSinceLastFailure > cooldownPeriod) {
			// Transition to half-open state
			circuitBreakers.set(serviceName, {
				...state,
				isOpen: false,
				failureCount: 0,
			});
			return { allowed: true };
		}

		return { allowed: false, reason: "Circuit breaker is open" };
	}

	return { allowed: true };
}

/**
 * Record circuit breaker success
 */
export function recordCircuitBreakerSuccess(serviceName: string): void {
	const state = circuitBreakers.get(serviceName) || {
		isOpen: false,
		failureCount: 0,
		lastFailureTime: 0,
		successCount: 0,
	};

	const newState: CircuitBreakerState = {
		...state,
		successCount: state.successCount + 1,
		failureCount: 0, // Reset failure count on success
	};

	// If we have enough successes, close the circuit
	if (newState.successCount >= 5) {
		newState.isOpen = false;
	}

	circuitBreakers.set(serviceName, newState);
}

/**
 * Record circuit breaker failure
 */
export function recordCircuitBreakerFailure(serviceName: string): void {
	const state = circuitBreakers.get(serviceName) || {
		isOpen: false,
		failureCount: 0,
		lastFailureTime: 0,
		successCount: 0,
	};

	const newState: CircuitBreakerState = {
		...state,
		failureCount: state.failureCount + 1,
		lastFailureTime: Date.now(),
		successCount: 0, // Reset success count on failure
	};

	// Open circuit if failure threshold reached
	if (newState.failureCount >= 5) {
		newState.isOpen = true;
	}

	circuitBreakers.set(serviceName, newState);
}

/**
 * Execute function with circuit breaker and retry
 */
export async function executeWithCircuitBreaker<T>(
	serviceName: string,
	fn: () => Promise<T>,
	retryOptions?: RetryOptions
): Promise<T> {
	// Check circuit breaker
	const circuitCheck = checkCircuitBreaker(serviceName);
	if (!circuitCheck.allowed) {
		throw new Error(`Circuit breaker is open for ${serviceName}: ${circuitCheck.reason}`);
	}

	try {
		const result = await executeWithRetry(fn, retryOptions);
		recordCircuitBreakerSuccess(serviceName);
		return result;
	} catch (error) {
		recordCircuitBreakerFailure(serviceName);
		throw error;
	}
}

/**
 * Get circuit breaker state
 */
export function getCircuitBreakerState(serviceName: string): CircuitBreakerState | null {
	return circuitBreakers.get(serviceName) || null;
}

/**
 * Reset circuit breaker
 */
export function resetCircuitBreaker(serviceName: string): void {
	circuitBreakers.delete(serviceName);
}
