# Appointment Assessment and Sync Script

## Overview

This script assesses appointments for a specific list of contacts and syncs confirmed appointments to Verity for analytics tracking.

## Purpose

The script:
1. Searches for contacts by name in GHL
2. Checks if they have appointments
3. Checks if their conversations have been reviewed
4. Assesses appointments for contacts with unreviewed conversations
5. Confirms appointments by analyzing appointment data
6. Syncs confirmed appointments to Verity

## Usage

Run the script with:

```bash
npx tsx scripts/assess-and-sync-appointments.ts
```

## How It Works

### 1. Contact Search
- Searches GHL contacts by full name
- Falls back to first name + last name search if exact match not found
- Returns the first matching contact

### 2. Appointment Retrieval
- Gets appointments from the last 90 days and next 90 days
- Filters appointments for the specific contact
- Uses GHL calendar events API

### 3. Conversation Review Check
A conversation is considered reviewed if:
- It has no unread messages, OR
- The last message was sent more than 24 hours ago (assumed reviewed)

If conversations haven't been reviewed, the script will assess each appointment individually.

### 4. Appointment Assessment
An appointment is confirmed if:
- It has a valid status (not cancelled or no-show)
- It has a startTime in the future or recent past (within 7 days)
- It has a title/notes indicating it's a real appointment

### 5. Sync to Verity
- Checks if appointment is already synced (avoids duplicates)
- Syncs confirmed appointments to Verity leads table
- Updates `ghl_appointment_id` field in Verity leads table

## Output

The script provides:
- Summary statistics (contacts found, appointments found, synced count)
- Detailed results for each contact including:
  - Contact ID
  - Number of appointments
  - Conversation review status
  - Confirmed appointments
  - Sync status
  - Any errors encountered

## Contacts Processed

The script processes 67 contacts:
- Adam Schaefer
- Alejandro Hernandez
- Andrew Clayton
- ... (see script for full list)

## Notes

- The script includes rate limiting (500ms delay between contacts)
- Errors are logged but don't stop processing
- Already-synced appointments are skipped
- Contacts not found in GHL are reported but don't cause failures

## Related Files

- `src/lib/sync/appointment-sync.ts` - Core sync logic
- `src/lib/workflows/appointments/ghl-appointment.ts` - GHL appointment API functions
- `src/lib/ghl/client.ts` - GHL API client

## Fixes Applied

Also fixed a bug in `src/lib/sync/appointment-sync.ts` where it was importing `getGhlContact` instead of `getContact`.
