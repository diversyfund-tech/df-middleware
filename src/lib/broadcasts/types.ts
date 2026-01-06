/**
 * Broadcast Analytics Types
 * 
 * Types for broadcast analytics data matching GHL Custom Object schema
 */

export interface BroadcastAnalyticsData {
	broadcastName: string;
	channel: "SMS" | "Email";
	sentAt: string | null;
	recipients: number;
	sent: number;
	delivered: number;
	pending: number;
	failed: number;
	responses: number;
	appointmentsSet: number;
	deliveryRate: number; // Percentage (0-100)
	responseRate: number; // Percentage (0-100)
	failureRate: number; // Percentage (0-100)
	conversionRate: number; // Percentage (0-100) - appointments / responses
}

export interface BroadcastWebhookPayload {
	broadcastId: string;
	eventType: "analytics_updated" | "broadcast_completed";
	timestamp?: string;
}


