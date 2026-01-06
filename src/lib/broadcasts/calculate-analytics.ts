/**
 * Calculate Broadcast Analytics from Verity Database
 * 
 * Queries Verity's database directly to calculate broadcast analytics.
 * Replicates the logic from Verity's calculateBroadcastAnalytics() function.
 */

import { getVerityDb } from "./verity-db";
import type { BroadcastAnalyticsData } from "./types";

/**
 * Calculate comprehensive analytics for a broadcast
 */
export async function calculateBroadcastAnalytics(
	broadcastId: string
): Promise<BroadcastAnalyticsData> {
	const db = getVerityDb();

	// 1. Get broadcast info
	const broadcast = await db`
		SELECT id, user_id, type, subject, executed_at, completed_at
		FROM broadcast
		WHERE id = ${broadcastId}
	`.then(rows => rows[0]);

	if (!broadcast) {
		throw new Error(`Broadcast not found: ${broadcastId}`);
	}

	const broadcastType = broadcast.type as "sms" | "email";
	const broadcastName = broadcast.subject || `${broadcastType.toUpperCase()} Broadcast ${broadcastId.substring(0, 8)}`;

	// 2. Aggregate recipient statuses
	// Calculate delivered count based on broadcast type
	const recipientStats = broadcastType === "sms"
		? await db`
			SELECT
				COUNT(*)::int as total_recipients,
				COUNT(*) FILTER (WHERE status = 'sent')::int as delivered_count_raw,
				0::int as delivered_count_email,
				COUNT(*) FILTER (WHERE status = 'failed')::int as failed_count,
				COUNT(*) FILTER (WHERE status = 'bounced')::int as bounced_count,
				COUNT(*) FILTER (WHERE status = 'opted_out')::int as opted_out_count,
				COUNT(*) FILTER (WHERE status = 'pending')::int as pending_count,
				COUNT(*) FILTER (WHERE status = 'opened')::int as opened_count,
				COUNT(*) FILTER (WHERE status = 'clicked')::int as clicked_count
			FROM broadcast_recipient
			WHERE broadcast_id = ${broadcastId}
		`.then(rows => rows[0])
		: await db`
			SELECT
				COUNT(*)::int as total_recipients,
				0::int as delivered_count_raw,
				COUNT(*) FILTER (WHERE status IN ('delivered', 'opened', 'clicked'))::int as delivered_count_email,
				COUNT(*) FILTER (WHERE status = 'failed')::int as failed_count,
				COUNT(*) FILTER (WHERE status = 'bounced')::int as bounced_count,
				COUNT(*) FILTER (WHERE status = 'opted_out')::int as opted_out_count,
				COUNT(*) FILTER (WHERE status = 'pending')::int as pending_count,
				COUNT(*) FILTER (WHERE status = 'opened')::int as opened_count,
				COUNT(*) FILTER (WHERE status = 'clicked')::int as clicked_count
			FROM broadcast_recipient
			WHERE broadcast_id = ${broadcastId}
		`.then(rows => rows[0]);

	const stats = recipientStats || {
		total_recipients: 0,
		delivered_count_raw: 0,
		delivered_count_email: 0,
		failed_count: 0,
		bounced_count: 0,
		opted_out_count: 0,
		pending_count: 0,
		opened_count: 0,
		clicked_count: 0,
	};

	// Calculate delivered count based on broadcast type
	const deliveredCount = broadcastType === "sms"
		? stats.delivered_count_raw // For SMS, 'sent' means delivered
		: stats.delivered_count_email; // For email, 'delivered'/'opened'/'clicked' means delivered

	const sentCount = deliveredCount + stats.failed_count; // Attempted = delivered + failed

	// 3. Count complaints
	const complaintCount = await db`
		SELECT COUNT(*)::int as count
		FROM broadcast_delivery_event bde
		INNER JOIN broadcast_recipient br ON bde.broadcast_recipient_id = br.id
		WHERE br.broadcast_id = ${broadcastId}
		AND (bde.event_type = 'complained' OR bde.event_type = 'spam_report')
	`.then(rows => rows[0]?.count || 0);

	// 4. Calculate response_count (SMS replies within 7 days)
	let responseCount = 0;
	let participantsWhoReceivedBroadcast = 0;

	if (broadcastType === "sms") {
		// Try to get sent participants from chat_message
		const sentParticipants = await db`
			SELECT DISTINCT participant_id, MIN(created_at) as first_sent_at
			FROM chat_message
			WHERE broadcast_id = ${broadcastId}
			AND status = 'sent'
			AND participant_id IS NOT NULL
			GROUP BY participant_id
		`;

		participantsWhoReceivedBroadcast = sentParticipants.length;

		if (sentParticipants.length > 0) {
			// Use chatMessage data
			for (const participant of sentParticipants) {
				if (!participant.participant_id || !participant.first_sent_at) continue;

				const firstSentAt = participant.first_sent_at instanceof Date
					? participant.first_sent_at
					: new Date(participant.first_sent_at);

				if (isNaN(firstSentAt.getTime())) continue;

				const sevenDaysLater = new Date(firstSentAt.getTime() + 7 * 24 * 60 * 60 * 1000);

				const receivedCount = await db`
					SELECT COUNT(*)::int as count
					FROM chat_message
					WHERE participant_id = ${participant.participant_id}
					AND status = 'received'
					AND created_at >= ${firstSentAt}
					AND created_at <= ${sevenDaysLater}
				`.then(rows => rows[0]?.count || 0);

				if (receivedCount > 0) {
					responseCount++;
				}
			}
		} else {
			// Fallback: use broadcastRecipient data
			const broadcastFull = await db`
				SELECT executed_at, user_id
				FROM broadcast
				WHERE id = ${broadcastId}
			`.then(rows => rows[0]);

			if (broadcastFull?.executed_at && broadcastFull.user_id) {
				const broadcastStartTime = broadcastFull.executed_at instanceof Date
					? broadcastFull.executed_at
					: new Date(broadcastFull.executed_at);

				if (!isNaN(broadcastStartTime.getTime())) {
					const sevenDaysLater = new Date(broadcastStartTime.getTime() + 7 * 24 * 60 * 60 * 1000);

					// Get delivered recipients with contact info
					const deliveredRecipients = await db`
						SELECT br.contact_id, br.sent_at, c.phone_e164
						FROM broadcast_recipient br
						INNER JOIN contacts c ON br.contact_id = c.id
						WHERE br.broadcast_id = ${broadcastId}
						AND br.status = 'sent'
						AND c.phone_e164 IS NOT NULL
					`;

					participantsWhoReceivedBroadcast = deliveredRecipients.length;

					// Get user's chat
					const userChat = await db`
						SELECT id
						FROM chat
						WHERE owner_id = ${broadcastFull.user_id}
						LIMIT 1
					`.then(rows => rows[0]);

					if (userChat) {
						const recipientPhones = deliveredRecipients
							.map(r => r.phone_e164)
							.filter(Boolean) as string[];

						if (recipientPhones.length > 0) {
							// Find participants by phone numbers
							const participants = await db`
								SELECT id, phone_number
								FROM chat_participant
								WHERE chat_id = ${userChat.id}
								AND phone_number = ANY(${recipientPhones})
							`;

							const phoneToParticipant = new Map(participants.map(p => [p.phone_number, p.id]));

							// Check for responses
							for (const recipient of deliveredRecipients) {
								if (!recipient.phone_e164) continue;

								const recipientSentAt = recipient.sent_at instanceof Date
									? recipient.sent_at
									: recipient.sent_at
										? new Date(recipient.sent_at)
										: broadcastStartTime;

								if (isNaN(recipientSentAt.getTime())) continue;

								const recipientSevenDaysLater = new Date(recipientSentAt.getTime() + 7 * 24 * 60 * 60 * 1000);

								const participantId = phoneToParticipant.get(recipient.phone_e164);
								if (participantId) {
									const receivedCount = await db`
										SELECT COUNT(*)::int as count
										FROM chat_message
										WHERE participant_id = ${participantId}
										AND status = 'received'
										AND created_at >= ${recipientSentAt}
										AND created_at <= ${recipientSevenDaysLater}
									`.then(rows => rows[0]?.count || 0);

									if (receivedCount > 0) {
										responseCount++;
									}
								}
							}
						}
					}
				}
			}
		}
	}

	// 5. Calculate timing metrics
	const timingStats = await db`
		SELECT
			MIN(sent_at) as first_sent_at,
			MAX(sent_at) as last_sent_at,
			AVG(EXTRACT(EPOCH FROM (delivered_at - sent_at)))::int as avg_delivery_time_seconds
		FROM broadcast_recipient
		WHERE broadcast_id = ${broadcastId}
		AND sent_at IS NOT NULL
	`.then(rows => rows[0] || {
		first_sent_at: null,
		last_sent_at: null,
		avg_delivery_time_seconds: null,
	});

	const firstSentAt = timingStats.first_sent_at
		? (timingStats.first_sent_at instanceof Date ? timingStats.first_sent_at : new Date(timingStats.first_sent_at))
		: null;

	const broadcastStartTime = firstSentAt || (broadcast.executed_at instanceof Date ? broadcast.executed_at : new Date(broadcast.executed_at)) || new Date(0);

	// 6. Calculate appointment_count
	const deliveredRecipients = broadcastType === "sms"
		? await db`
			SELECT DISTINCT contact_id
			FROM broadcast_recipient
			WHERE broadcast_id = ${broadcastId}
			AND status = 'sent'
		`
		: await db`
			SELECT DISTINCT contact_id
			FROM broadcast_recipient
			WHERE broadcast_id = ${broadcastId}
			AND status IN ('delivered', 'opened', 'clicked')
		`;

	const deliveredContactIds = deliveredRecipients.map(r => r.contact_id);

	let appointmentCount = 0;
	if (deliveredContactIds.length > 0) {
		const appointments = await db`
			SELECT COUNT(*)::int as count
			FROM leads
			WHERE contact_id = ANY(${deliveredContactIds})
			AND ghl_appointment_id IS NOT NULL
			AND COALESCE(last_activity_at, created_at) >= ${broadcastStartTime}
		`.then(rows => rows[0]?.count || 0);

		appointmentCount = appointments;
	}

	// 7. Calculate rates
	const deliveryRate = sentCount > 0
		? Math.round((deliveredCount / sentCount) * 100 * 100) / 100
		: 0;

	const failureRate = sentCount > 0
		? Math.round(((stats.failed_count + stats.bounced_count) / sentCount) * 100 * 100) / 100
		: 0;

	const optOutRate = deliveredCount > 0
		? Math.round((stats.opted_out_count / deliveredCount) * 100 * 100) / 100
		: 0;

	const responseRate = deliveredCount > 0
		? Math.round((responseCount / deliveredCount) * 100 * 100) / 100
		: 0;

	const conversionRate = responseCount > 0
		? Math.round((appointmentCount / responseCount) * 100 * 100) / 100
		: 0;

	// 8. Format sent_at timestamp
	const sentAt = broadcast.executed_at instanceof Date
		? broadcast.executed_at.toISOString()
		: broadcast.executed_at
			? new Date(broadcast.executed_at).toISOString()
			: null;

	return {
		broadcastName,
		channel: broadcastType === "sms" ? "SMS" : "Email",
		sentAt,
		recipients: stats.total_recipients,
		sent: sentCount,
		delivered: deliveredCount,
		pending: stats.pending_count,
		failed: stats.failed_count,
		responses: responseCount,
		appointmentsSet: appointmentCount,
		deliveryRate,
		responseRate,
		failureRate,
		conversionRate,
	};
}

