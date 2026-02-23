/**
 * Rate limiting middleware for Express
 */

import rateLimit from "express-rate-limit";

/**
 * Default rate limiter for API endpoints
 * Allows 100 requests per 15 minutes per IP
 */
export const apiRateLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: parseInt(process.env.RATE_LIMIT_MAX || "100", 10), // Limit each IP to 100 requests per windowMs
	standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers
	message: "Too many requests from this IP, please try again later.",
	skip: (req) => {
		// Skip rate limiting for health checks
		return req.path === "/health";
	},
});

/**
 * Strict rate limiter for webhook endpoints
 * Allows 1000 requests per 15 minutes per IP (webhooks can be high volume)
 */
export const webhookRateLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: parseInt(process.env.WEBHOOK_RATE_LIMIT_MAX || "1000", 10), // Limit each IP to 1000 requests per windowMs
	standardHeaders: true,
	legacyHeaders: false,
	message: "Too many webhook requests from this IP, please try again later.",
});

/**
 * Strict rate limiter for admin endpoints
 * Allows 50 requests per 15 minutes per IP
 */
export const adminRateLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: parseInt(process.env.ADMIN_RATE_LIMIT_MAX || "50", 10), // Limit each IP to 50 requests per windowMs
	standardHeaders: true,
	legacyHeaders: false,
	message: "Too many admin requests from this IP, please try again later.",
});
