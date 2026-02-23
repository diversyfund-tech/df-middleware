# Vercel Environment Variables Comparison

## Missing from .env.vercel (Need to Add)

### Critical OAuth Variables
- ❌ `GHL_CLIENT_ID=6953d6aa4b770d0bf8434e1d-mjsthmxx`
- ❌ `GHL_CLIENT_SECRET=c5ee14da-f39c-4061-a2d7-1714aa924db1`
- ❌ `GHL_CONVERSATION_PROVIDER_ID=695403c62238096934880f15`

### Verity Database
- ❌ `VERITY_DATABASE_URL=postgresql://neondb_owner:LYtOTMa8rk5p@ep-late-shape-a6nsw636-pooler.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require`

## Present in Both (✅ Synced)

- ✅ DATABASE_URL
- ✅ GHL_API_KEY
- ✅ GHL_LOCATION_ID
- ✅ GHL_CALENDAR_ID
- ✅ GHL_BASE_URL
- ✅ ALOWARE_API_TOKEN
- ✅ ALOWARE_WEBHOOK_BASIC_USER
- ✅ ALOWARE_WEBHOOK_BASIC_PASS
- ✅ ALOWARE_WEBHOOK_ALLOWED_EVENTS
- ✅ BASE_URL
- ✅ NODE_ENV
- ✅ X_DF_JOBS_SECRET
- ✅ JOBS_BATCH_SIZE
- ✅ VERITY_BASE_URL
- ✅ VERITY_API_KEY
- ✅ VERITY_WEBHOOK_SECRET
- ✅ TEXTING_SYNC_TO_ALOWARE
- ✅ DF_ADMIN_SECRET
- ✅ CONTACT_SOURCE_OF_TRUTH
- ✅ ALERT_WEBHOOK_URL

## Action Required

**Add these to Vercel environment variables:**
1. `GHL_CLIENT_ID` - Required for OAuth token exchange
2. `GHL_CLIENT_SECRET` - Required for OAuth token exchange
3. `GHL_CONVERSATION_PROVIDER_ID` - Required for message imports
4. `VERITY_DATABASE_URL` - Required for Verity database access

These are critical for the OAuth implementation and message import functionality!




