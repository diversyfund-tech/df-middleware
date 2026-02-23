# Connected Systems Explained

This guide explains each system that DF-Middleware connects, what they do, and how they work together.

## Overview

DF-Middleware connects four main business systems. Each system has its own purpose, but they all work together to give you a complete picture of your business operations.

## GoHighLevel (GHL)

### What It Is

**GoHighLevel** (often called "GHL") is your main **Customer Relationship Management (CRM) system**. Think of it as your central hub for managing customer relationships.

### What It Does

- **Stores contact information** - Names, phone numbers, emails, addresses
- **Manages conversations** - Tracks all communication with contacts
- **Handles appointments** - Schedules and manages meetings
- **Organizes with tags** - Categorizes contacts for easy management
- **Tracks interactions** - Keeps a history of all customer touchpoints

### In Business Terms

GHL is like your **digital filing cabinet** where you keep everything about your customers. When you need to know who you've talked to, when you last contacted someone, or what you discussed, GHL is where you look.

### What Syncs From GHL

When you do something in GHL, DF-Middleware shares it with other systems:

- ✅ **New contacts** → Appear in Aloware and Verity automatically
- ✅ **Contact updates** → Sync to Aloware and Verity automatically
- ✅ **Tags** → May create lists in Aloware automatically
- ✅ **Appointments** → May sync to other systems (depending on configuration)

### What Syncs To GHL

When something happens in other systems, it appears in GHL:

- ✅ **Calls from Aloware** → Call records appear in GHL automatically
- ✅ **Messages from texting** → Messages appear in GHL conversations automatically
- ✅ **Contact updates from Aloware** → Updates appear in GHL automatically

### Common Uses

- Adding new contacts
- Viewing conversation history
- Scheduling appointments
- Tagging contacts for campaigns
- Reviewing customer interaction history

## Aloware

### What It Is

**Aloware** is your **calling and power dialer system**. It's designed specifically for making phone calls efficiently and tracking call outcomes.

### What It Does

- **Manages phone calls** - Makes and receives calls
- **Power dialing** - Automatically dials numbers from call lists
- **Call tracking** - Records who was called, when, and the outcome
- **Call lists** - Organizes contacts into lists for calling campaigns
- **Call analytics** - Provides reports on call activity and performance

### In Business Terms

Aloware is like your **phone operations center**. When you need to make calls, track call results, or manage calling campaigns, Aloware is your tool.

### What Syncs From Aloware

When you do something in Aloware, DF-Middleware shares it with other systems:

- ✅ **New contacts** → Appear in GHL and Verity automatically
- ✅ **Contact updates** → Sync to GHL and Verity automatically
- ✅ **Call records** → Appear in GHL automatically
- ✅ **Call outcomes** → May update contact status in GHL automatically

### What Syncs To Aloware

When something happens in other systems, it appears in Aloware:

- ✅ **Contacts from GHL** → Appear in Aloware automatically
- ✅ **Tags from GHL** → May create call lists in Aloware automatically
- ✅ **Messages from texting** → May sync to Aloware (if configured)

### Common Uses

- Making outbound calls
- Receiving inbound calls
- Managing call lists
- Tracking call outcomes
- Running calling campaigns

## Verity

### What It Is

**Verity** is your **capital management platform**. It handles investor relationships, financial data, and business operations related to capital management.

### What It Does

- **Investor management** - Tracks investor information and relationships
- **Financial operations** - Manages financial transactions and records
- **Business operations** - Handles operational aspects of capital management
- **Data management** - Stores and manages business-critical data

### In Business Terms

Verity is like your **financial operations center**. It handles the business side of managing investors, capital, and financial operations.

### What Syncs From Verity

When something happens in Verity, DF-Middleware may share it with other systems:

- ✅ **Investor contacts** → May sync to GHL and Aloware (depending on configuration)
- ✅ **Contact updates** → May sync to other systems (depending on configuration)

### What Syncs To Verity

When something happens in other systems, it may appear in Verity:

- ✅ **Contacts from GHL** → May sync to Verity automatically
- ✅ **Contacts from Aloware** → May sync to Verity automatically
- ✅ **Interaction data** → May sync to Verity for reporting

### Common Uses

- Managing investor relationships
- Tracking financial operations
- Viewing business data
- Managing capital operations

**Note:** Verity integration details may vary based on your specific configuration. Contact IT if you need details about what syncs to/from Verity in your setup.

## Texting System

### What It Is

The **Texting System** is your **SMS messaging platform**. It handles sending and receiving text messages with contacts.

### What It Does

- **Sends text messages** - Sends SMS messages to contacts
- **Receives text messages** - Receives incoming SMS messages
- **Manages conversations** - Keeps track of text message threads
- **Handles opt-outs** - Manages when people opt out of receiving texts
- **Tracks delivery** - Knows when messages are delivered or fail

### In Business Terms

The Texting System is like your **text messaging center**. When you need to send a text, receive a text, or manage text conversations, this is your system.

### What Syncs From Texting

When something happens in the Texting System, DF-Middleware shares it with other systems:

- ✅ **Incoming messages** → Appear in GHL conversations automatically
- ✅ **Outgoing messages** → Appear in GHL conversations automatically
- ✅ **Opt-out requests** → Update all systems automatically (contact is marked as opted out)
- ✅ **Message delivery status** → May sync to GHL (depending on configuration)

### What Syncs To Texting

When something happens in other systems, it may affect texting:

- ✅ **Contact updates** → May update texting system contact information
- ✅ **Opt-out status** → Opt-outs from other systems sync to texting system

### Common Uses

- Sending text messages to contacts
- Receiving text messages from contacts
- Managing text conversations
- Handling opt-out requests
- Tracking message delivery

## How These Systems Work Together

### The Big Picture

Each system has its specialty, but together they give you a complete view:

```
┌─────────────┐
│   GHL       │ ← Your CRM (customer relationships)
│  (CRM)      │
└──────┬──────┘
       │
       │ DF-Middleware connects them all
       │
┌──────┴──────┐     ┌─────────────┐
│  Aloware   │     │   Verity    │
│  (Calls)   │     │  (Capital)  │
└──────┬──────┘     └─────────────┘
       │
       │
┌──────┴──────┐
│  Texting   │
│  (SMS)     │
└────────────┘
```

### Information Flow Example

**Scenario:** You add a new contact "Jane Doe" in GoHighLevel.

**What Happens:**

1. **GHL** stores Jane Doe's information
2. **DF-Middleware** notices the new contact
3. **DF-Middleware** creates Jane Doe in:
   - Aloware (so you can call her)
   - Verity (if investor-related)
   - Texting system (so you can text her)
4. **Result:** Jane Doe now exists in all systems automatically

**Time:** This happens in seconds, automatically.

### What Information Syncs Between Them

| Information Type | GHL ↔ Aloware | GHL ↔ Verity | GHL ↔ Texting | Aloware ↔ Texting |
|-----------------|---------------|--------------|---------------|-------------------|
| **Contacts** | ✅ Yes | ✅ Yes* | ✅ Yes* | ✅ Yes* |
| **Calls** | ✅ Yes (Aloware→GHL) | ❌ No | ❌ No | ❌ No |
| **Messages** | ❌ No | ❌ No | ✅ Yes | ✅ Yes* |
| **Tags/Lists** | ✅ Yes (GHL→Aloware) | ❌ No | ❌ No | ❌ No |
| **Opt-outs** | ✅ Yes | ✅ Yes* | ✅ Yes | ✅ Yes |

*May depend on your specific configuration

## What This Means For You

### Daily Work Impact

- **You can use any system** - Information will sync automatically
- **No need to enter data twice** - Enter it once, it appears everywhere
- **Complete picture** - See all interactions regardless of which system you're using

### Best Practices

1. **Use the right system for the task**
   - GHL for customer relationship management
   - Aloware for making calls
   - Texting system for sending texts
   - Verity for capital management

2. **Trust the sync** - Information will appear in other systems automatically

3. **Report issues** - If something doesn't sync, let IT know

### What to Expect

- ✅ Contacts appear in multiple systems automatically
- ✅ Call records sync from Aloware to GHL automatically
- ✅ Messages sync from texting to GHL automatically
- ✅ Changes propagate automatically
- ✅ Everything stays synchronized

## Common Questions

**Q: Do I need to use all four systems?**  
A: No. Use the systems you need for your work. DF-Middleware handles the connections automatically.

**Q: Which system should I use for [specific task]?**  
A: Use the system designed for that task (GHL for CRM, Aloware for calls, etc.). Information will sync automatically.

**Q: What if I only use one system?**  
A: That's fine! DF-Middleware will still sync information to other systems as needed.

**Q: Can I see sync status?**  
A: Yes, check the visual documentation at `/docs/visual` to see real-time sync status.

## Next Steps

- **Read [Common Scenarios](04-common-scenarios.md)** to see how these systems work together in real situations
- **Check [How It Works](02-how-it-works.md)** to understand synchronization in detail
- **Review [Troubleshooting](06-troubleshooting.md)** if you encounter sync issues

---

**Need more details?** Check the [Glossary](08-glossary.md) for definitions of technical terms.
