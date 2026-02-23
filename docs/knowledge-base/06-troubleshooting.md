# Troubleshooting Guide

This guide helps you solve common issues with DF-Middleware. Follow these steps to diagnose and resolve problems.

## Before You Start

### Quick Checks

1. **Wait a moment** - Some syncs take a few seconds. Wait 1-2 minutes before troubleshooting.
2. **Check visual documentation** - Visit `/docs/visual` to see if there are system-wide issues.
3. **Try refreshing** - Sometimes a simple refresh solves display issues.

### Information to Gather

Before contacting IT support, gather this information:
- **What system were you using?** (GoHighLevel, Aloware, Verity, Texting)
- **What action were you trying to perform?** (Add contact, make call, send message, etc.)
- **When did it happen?** (Date and approximate time)
- **What did you expect to happen?** (What should have synced or appeared)
- **What actually happened?** (What you observed)

## Common Issues and Solutions

### Data Not Syncing

#### Problem: Contact added in one system doesn't appear in another system

**Possible Causes:**
- Sync is still in progress (takes a few seconds)
- System connectivity issue
- Contact information conflict

**Solutions:**

1. **Wait 2-3 minutes** - Syncs usually happen within seconds, but complex operations can take longer.

2. **Check if contact exists** - Search for the contact in the target system:
   - Try searching by phone number
   - Try searching by email
   - Try searching by name

3. **Check visual documentation** - Visit `/docs/visual` to see if there are system issues.

4. **Verify contact information** - Make sure the contact has:
   - At least a phone number OR email address
   - Valid contact information (not blank)

5. **If still not syncing after 5 minutes:**
   - Note the contact details (name, phone, email)
   - Note which system you added it in
   - Note which system it should appear in
   - Contact IT support with these details

#### Problem: Call record doesn't appear in GoHighLevel

**Possible Causes:**
- Call was made very recently (sync in progress)
- Contact doesn't exist in GoHighLevel
- Call wasn't properly recorded in Aloware

**Solutions:**

1. **Wait 1-2 minutes** - Call syncs usually happen within seconds.

2. **Check if contact exists** - The call record needs a contact to attach to:
   - Search for the contact in GoHighLevel
   - If contact doesn't exist, add it first
   - The call record should sync after the contact is created

3. **Verify call in Aloware** - Make sure the call was properly recorded:
   - Check Aloware call history
   - Verify call details are complete

4. **If still not syncing after 5 minutes:**
   - Note the call details (who was called, when, duration)
   - Note the contact information
   - Contact IT support with these details

#### Problem: Message doesn't appear in GoHighLevel conversation

**Possible Causes:**
- Message was just sent/received (sync in progress)
- Contact doesn't exist in GoHighLevel
- Message sync is delayed

**Solutions:**

1. **Wait 1-2 minutes** - Message syncs usually happen within seconds.

2. **Check if contact exists** - The message needs a contact to attach to:
   - Search for the contact in GoHighLevel
   - If contact doesn't exist, add it first
   - The message should sync after the contact is created

3. **Check conversation thread** - Messages appear in conversation threads:
   - Look for the contact's conversation thread
   - Check if message appears there

4. **If still not syncing after 5 minutes:**
   - Note the message details (who it was to/from, when, content)
   - Note the contact information
   - Contact IT support with these details

### Contact Missing

#### Problem: Contact exists in one system but not another

**Possible Causes:**
- Contact was added before DF-Middleware was set up
- Sync failed for this specific contact
- Contact information conflict

**Solutions:**

1. **Check if contact should sync** - Not all contacts sync automatically:
   - Verify the contact has valid information (phone or email)
   - Check if contact meets sync criteria

2. **Manually add contact** - If contact doesn't sync automatically:
   - Add the contact manually in the target system
   - DF-Middleware will create a mapping for future syncs

3. **Check for duplicates** - Contact might exist under a different name:
   - Search by phone number
   - Search by email address
   - Check for similar names

4. **If contact should have synced:**
   - Note the contact details (name, phone, email)
   - Note which system it exists in
   - Note which system it should be in
   - Contact IT support with these details

### Message Not Appearing

#### Problem: Sent message doesn't appear in conversation history

**Possible Causes:**
- Message was just sent (sync in progress)
- Contact doesn't exist in target system
- Message sync is delayed

**Solutions:**

1. **Wait 1-2 minutes** - Message syncs usually happen within seconds.

2. **Check contact exists** - Message needs a contact to attach to:
   - Verify contact exists in GoHighLevel
   - If not, add contact first

3. **Check conversation thread** - Messages appear in threads:
   - Look for the contact's conversation
   - Check if it's in a different thread

4. **Verify message was sent** - Confirm message was actually sent:
   - Check sending system for confirmation
   - Verify message wasn't blocked or failed

5. **If still not appearing after 5 minutes:**
   - Note the message details (to/from, when, content)
   - Note the contact information
   - Contact IT support with these details

### Opt-Out Not Working

#### Problem: Contact opted out but still receiving messages

**Possible Causes:**
- Opt-out sync is in progress
- Opt-out wasn't properly detected
- Multiple contact records

**Solutions:**

1. **Wait 1-2 minutes** - Opt-out syncs usually happen within seconds.

2. **Verify opt-out was detected** - Check if opt-out was properly recorded:
   - Look for opt-out status in the system
   - Verify "STOP" message was received

3. **Check for multiple contacts** - Contact might exist multiple times:
   - Search for all instances of the contact
   - Ensure all instances are marked as opted out

4. **Verify opt-out status** - Check opt-out registry:
   - Contact should be marked as opted out
   - Status should be synced across all systems

5. **If still receiving messages after opt-out:**
   - Note the contact details (name, phone)
   - Note when opt-out was requested
   - Note which system they opted out from
   - Contact IT support immediately (this is important for compliance)

### System Status Issues

#### Problem: Systems appear disconnected or not syncing

**Possible Causes:**
- Temporary system connectivity issue
- System maintenance in progress
- Configuration issue

**Solutions:**

1. **Check visual documentation** - Visit `/docs/visual` to see system status:
   - Check integration status
   - Look for error indicators
   - Check system health

2. **Wait and retry** - Temporary issues often resolve themselves:
   - Wait 5-10 minutes
   - Try your action again
   - Check if sync works now

3. **Check for maintenance** - System might be under maintenance:
   - Check for maintenance notifications
   - Wait for maintenance to complete

4. **If issue persists:**
   - Note what you were trying to do
   - Note when the issue started
   - Note any error messages you saw
   - Contact IT support with these details

## When to Contact IT Support

### Contact IT Immediately If:

- ❌ **Opt-out not working** - This is a compliance issue
- ❌ **Data loss** - Information is missing or deleted
- ❌ **System completely down** - Nothing is syncing
- ❌ **Security concerns** - Unauthorized access or data breach

### Contact IT Soon If:

- ⚠️ **Sync not working after 5 minutes** - After trying troubleshooting steps
- ⚠️ **Consistent errors** - Same error happening repeatedly
- ⚠️ **Performance issues** - System is very slow or unresponsive
- ⚠️ **Unexpected behavior** - Something happening that shouldn't

### Before Contacting IT, Have Ready:

1. **What you were doing** - Specific action you were trying to perform
2. **When it happened** - Date and approximate time
3. **What you expected** - What should have happened
4. **What actually happened** - What you observed
5. **What you've tried** - Troubleshooting steps you've already taken
6. **Screenshots** - If applicable, screenshots of errors or issues

## How to Report Issues

### Step 1: Gather Information

- System you were using
- Action you were trying to perform
- Date and time
- Expected vs. actual behavior
- Screenshots (if applicable)

### Step 2: Check Troubleshooting Steps

- Review this guide
- Try the suggested solutions
- Note what worked and what didn't

### Step 3: Contact IT Support

- Provide all gathered information
- Be specific about the issue
- Include any error messages
- Mention what troubleshooting you've tried

## Prevention Tips

### Best Practices

1. **Use valid contact information** - Ensure contacts have phone numbers or email addresses
2. **Wait for syncs** - Allow a few seconds for automatic syncing
3. **Check before duplicating** - Search for contacts before adding new ones
4. **Report issues promptly** - Don't wait if something seems wrong
5. **Keep systems updated** - Use the latest versions of your business tools

### Common Mistakes to Avoid

- ❌ **Adding duplicate contacts** - Search first, then add
- ❌ **Expecting instant sync** - Allow a few seconds for processing
- ❌ **Ignoring errors** - Report issues promptly
- ❌ **Manual workarounds** - Let DF-Middleware handle syncing automatically

## Next Steps

- **Read [FAQ](07-faq.md)** for answers to common questions
- **Check [Common Scenarios](04-common-scenarios.md)** to understand expected behavior
- **Review [How It Works](02-how-it-works.md)** to understand synchronization

---

**Still having issues?** Contact IT support with the information gathered from this guide.
