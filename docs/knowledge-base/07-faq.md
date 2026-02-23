# Frequently Asked Questions (FAQ)

Common questions about DF-Middleware answered in plain language.

## General Questions

### What is DF-Middleware?

DF-Middleware is an automated system that keeps your business tools (GoHighLevel, Aloware, Verity, and Texting) synchronized. It automatically shares information between systems so you don't have to enter data multiple times.

**See also:** [Getting Started Guide](01-getting-started.md)

### Do I need to learn how to use DF-Middleware?

No! DF-Middleware works automatically in the background. You continue using your normal business tools (GoHighLevel, Aloware, etc.) as you always have. DF-Middleware handles the connections automatically.

### Will DF-Middleware change how I work?

No. DF-Middleware works behind the scenes. You'll just notice that information syncs automatically between systems. Your daily work process stays the same.

### How do I know if DF-Middleware is working?

You'll see contacts, calls, and messages appearing in multiple systems automatically. You can also check the visual documentation at `/docs/visual` to see real-time system status.

## Synchronization Questions

### How fast does syncing happen?

Most syncs happen within seconds. Complex operations may take a minute or two. Everything happens automatically - you don't need to wait or check.

### What happens if I add a contact in GoHighLevel?

The contact automatically appears in Aloware and Verity within seconds. You don't need to do anything else.

**See also:** [Common Scenarios: When a New Contact is Added](04-common-scenarios.md#when-a-new-contact-is-added)

### What happens if I make a call in Aloware?

The call record automatically appears in GoHighLevel within seconds, linked to the contact's record.

**See also:** [Common Scenarios: When a Call is Made](04-common-scenarios.md#when-a-call-is-made)

### What happens if I send a text message?

The message automatically appears in GoHighLevel's conversation history within seconds, linked to the contact's record.

**See also:** [Common Scenarios: When a Message is Sent](04-common-scenarios.md#when-a-message-is-sent)

### What if information is different in different systems?

DF-Middleware handles conflicts automatically. It checks the "source of truth" configuration and applies merge rules to determine which information to keep. Both systems are then updated with the correct information.

**See also:** [How It Works: Conflict Handling](02-how-it-works.md#what-happens-when-theres-a-conflict)

### Can I sync manually?

No manual syncing is needed. DF-Middleware handles all syncing automatically. If something doesn't sync, check the [Troubleshooting Guide](06-troubleshooting.md).

## System Questions

### Which systems are connected?

DF-Middleware connects:
- **GoHighLevel (GHL)** - Your CRM system
- **Aloware** - Your calling/power dialer system
- **Verity** - Your capital management platform
- **Texting System** - Your SMS messaging system

**See also:** [Connected Systems Guide](03-connected-systems.md)

### Do I need to use all four systems?

No. Use the systems you need for your work. DF-Middleware handles the connections automatically. Information will sync to other systems as needed.

### Which system should I use for [specific task]?

Use the system designed for that task:
- **GoHighLevel** - For customer relationship management, contacts, conversations, appointments
- **Aloware** - For making calls, managing call lists, tracking call outcomes
- **Verity** - For capital management, investor relationships, financial operations
- **Texting System** - For sending and receiving text messages

Information will sync automatically between systems.

### Can I see sync status?

Yes! Visit `/docs/visual` to see:
- Real-time integration status
- System health
- Data flow visualizations
- Recent sync activity

## Workflow Questions

### What are workflows?

Workflows are automated processes that perform a series of steps to complete tasks. DF-Middleware has sync workflows (for data synchronization), voice agent workflows (for AI phone calls), and business process workflows (for complex business tasks).

**See also:** [Workflows Explained](05-workflows-explained.md)

### Do I need to start workflows?

No. Workflows run automatically. Sync workflows run whenever data needs to sync. Voice agent workflows run when AI calls are made. Business process workflows run when triggered by specific events.

### How do workflows help me?

Workflows save time by automating routine tasks, reduce errors through consistent processes, and ensure everything happens in the right order automatically.

**See also:** [Workflows Explained: How Workflows Help](05-workflows-explained.md#how-workflows-help-daily-operations)

## Troubleshooting Questions

### What if something doesn't sync?

1. Wait 2-3 minutes (some syncs take time)
2. Check if the contact/information exists in the target system
3. Verify the information is valid (not blank)
4. Check the visual documentation for system issues
5. If still not syncing after 5 minutes, check the [Troubleshooting Guide](06-troubleshooting.md)

**See also:** [Troubleshooting Guide](06-troubleshooting.md)

### What if a contact is missing?

1. Check if the contact exists in another system
2. Search by phone number or email
3. Check for duplicates under different names
4. If contact should exist, check the [Troubleshooting Guide](06-troubleshooting.md)

**See also:** [Troubleshooting: Contact Missing](06-troubleshooting.md#contact-missing)

### What if opt-out isn't working?

This is important for compliance. If someone opts out but still receives messages:
1. Wait 1-2 minutes (opt-out syncs usually happen quickly)
2. Verify opt-out was detected
3. Check for multiple contact records
4. **Contact IT support immediately** if still receiving messages after opt-out

**See also:** [Troubleshooting: Opt-Out Not Working](06-troubleshooting.md#opt-out-not-working)

### When should I contact IT support?

Contact IT immediately for:
- Opt-out not working (compliance issue)
- Data loss
- System completely down
- Security concerns

Contact IT soon for:
- Sync not working after 5 minutes (after trying troubleshooting)
- Consistent errors
- Performance issues
- Unexpected behavior

**See also:** [Troubleshooting: When to Contact IT](06-troubleshooting.md#when-to-contact-it-support)

## Data Questions

### What information syncs between systems?

- **Contacts** - Names, phone numbers, emails, addresses sync between all systems
- **Calls** - Call records sync from Aloware to GoHighLevel
- **Messages** - Text messages sync from Texting System to GoHighLevel (and optionally Aloware)
- **Tags/Lists** - Tags from GoHighLevel may create lists in Aloware
- **Opt-outs** - Opt-out status syncs across all systems

**See also:** [Connected Systems: What Information Syncs](03-connected-systems.md#what-information-syncs-between-them)

### What doesn't sync automatically?

Some information may not sync depending on your configuration:
- **Appointments** - May or may not sync (depends on configuration)
- **Custom fields** - May or may not sync (depends on configuration)
- **System-specific data** - Some data is unique to each system

Contact IT if you need details about what syncs in your specific setup.

### Can I prevent certain information from syncing?

Sync behavior is configured by IT. If you need to change what syncs, contact IT support with your requirements.

### What if I see duplicate contacts?

DF-Middleware creates mappings to prevent duplicates. If you see duplicates:
1. Check if they're actually the same person (same phone/email)
2. Contact IT support - they can merge duplicates and fix mappings

## Technical Questions

### What is a webhook?

A webhook is like a doorbell notification. When something happens in a system, it "rings the doorbell" to let DF-Middleware know. Think of it as an automatic alert.

**See also:** [Glossary: Webhook](08-glossary.md#webhook)

### What is a mapping?

A mapping is like a directory that remembers "Contact #12345 in GoHighLevel is the same person as Contact #67890 in Aloware." DF-Middleware uses mappings to keep track of which records in different systems refer to the same person or thing.

**See also:** [Glossary: Mapping](08-glossary.md#mapping)

### What is bidirectional sync?

Bidirectional sync means information flows both ways. If you update a contact in GoHighLevel, it updates in Aloware. If you update it in Aloware, it updates in GoHighLevel. Both directions work automatically.

**See also:** [Glossary: Bidirectional Sync](08-glossary.md#bidirectional-sync)

### What is source of truth?

The source of truth is the system that has the "official" or "most accurate" version of information. When there's a conflict (like two different phone numbers), DF-Middleware knows which system to trust.

**See also:** [Glossary: Source of Truth](08-glossary.md#source-of-truth)

## Best Practices Questions

### What are best practices for using DF-Middleware?

1. **Use valid contact information** - Ensure contacts have phone numbers or email addresses
2. **Wait for syncs** - Allow a few seconds for automatic syncing
3. **Check before duplicating** - Search for contacts before adding new ones
4. **Report issues promptly** - Don't wait if something seems wrong
5. **Keep systems updated** - Use the latest versions of your business tools

**See also:** [Troubleshooting: Prevention Tips](06-troubleshooting.md#prevention-tips)

### What should I avoid?

- ❌ Adding duplicate contacts (search first, then add)
- ❌ Expecting instant sync (allow a few seconds)
- ❌ Ignoring errors (report issues promptly)
- ❌ Manual workarounds (let DF-Middleware handle syncing automatically)

## Still Have Questions?

- **Check the [Glossary](08-glossary.md)** for definitions of terms
- **Review [Common Scenarios](04-common-scenarios.md)** for real-world examples
- **Read [How It Works](02-how-it-works.md)** for detailed explanations
- **Contact IT support** if you can't find your answer here

---

**Can't find your question?** Contact IT support and they can help you find the answer.
