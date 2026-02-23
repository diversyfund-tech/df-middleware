# Add Missing Environment Variables to Vercel

## Variables to Add

Run these commands in your terminal (or add via Vercel Dashboard):

### Option 1: Vercel CLI (Interactive)

```bash
# GHL OAuth Client ID
vercel env add GHL_CLIENT_ID production
# Enter: 6953d6aa4b770d0bf8434e1d-mjsthmxx

# GHL OAuth Client Secret
vercel env add GHL_CLIENT_SECRET production
# Enter: c5ee14da-f39c-4061-a2d7-1714aa924db1

# GHL Conversation Provider ID
vercel env add GHL_CONVERSATION_PROVIDER_ID production
# Enter: 695403c62238096934880f15

# Verity Database URL
vercel env add VERITY_DATABASE_URL production
# Enter: postgresql://neondb_owner:LYtOTMa8rk5p@ep-late-shape-a6nsw636-pooler.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

### Option 2: Vercel Dashboard

1. Go to: https://vercel.com/diversyfund-tech/df-middleware/settings/environment-variables
2. Add each variable:
   - **GHL_CLIENT_ID**: `6953d6aa4b770d0bf8434e1d-mjsthmxx`
   - **GHL_CLIENT_SECRET**: `c5ee14da-f39c-4061-a2d7-1714aa924db1`
   - **GHL_CONVERSATION_PROVIDER_ID**: `695403c62238096934880f15`
   - **VERITY_DATABASE_URL**: `postgresql://neondb_owner:LYtOTMa8rk5p@ep-late-shape-a6nsw636-pooler.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require`
3. Make sure they're enabled for **Production** environment
4. Save

### Option 3: One-liner Commands (if CLI supports it)

```bash
echo "6953d6aa4b770d0bf8434e1d-mjsthmxx" | vercel env add GHL_CLIENT_ID production
echo "c5ee14da-f39c-4061-a2d7-1714aa924db1" | vercel env add GHL_CLIENT_SECRET production
echo "695403c62238096934880f15" | vercel env add GHL_CONVERSATION_PROVIDER_ID production
echo "postgresql://neondb_owner:LYtOTMa8rk5p@ep-late-shape-a6nsw636-pooler.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require" | vercel env add VERITY_DATABASE_URL production
```

## After Adding

1. Redeploy the application (or wait for next deployment)
2. Verify variables are set: `vercel env ls`
3. Test OAuth flow in production




