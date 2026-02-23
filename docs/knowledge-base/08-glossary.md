# Glossary of Terms

Plain language definitions of technical terms used in DF-Middleware documentation.

## A

### Aloware
Your calling and power dialer system. Used for making phone calls, managing call lists, and tracking call outcomes.

**See also:** [Connected Systems: Aloware](03-connected-systems.md#aloware)

### API (Application Programming Interface)
A way for different computer systems to talk to each other. Think of it like a translator that helps systems understand each other's language.

**In DF-Middleware:** APIs allow GoHighLevel, Aloware, Verity, and the Texting System to communicate with DF-Middleware.

## B

### Bidirectional Sync
When information flows both ways between systems. If you update something in System A, it updates in System B. If you update it in System B, it updates in System A. Both directions work automatically.

**Example:** Contact information syncs bidirectionally between GoHighLevel and Aloware.

**See also:** [How It Works: Bidirectional Sync](02-how-it-works.md)

## C

### Contact Mapping
A record that remembers which contacts in different systems are the same person. For example, "Contact #12345 in GoHighLevel is the same person as Contact #67890 in Aloware."

**Why it matters:** Mappings help DF-Middleware know which records to update when information changes.

**See also:** [How It Works: Mapping](02-how-it-works.md#common-terms-explained)

### CRM (Customer Relationship Management)
A system for managing customer relationships. GoHighLevel is your CRM system - it stores contacts, conversations, appointments, and interaction history.

**See also:** [Connected Systems: GoHighLevel](03-connected-systems.md#gohighlevel-ghl)

## D

### DF-Middleware
The automated system that keeps your business tools synchronized. It automatically shares information between GoHighLevel, Aloware, Verity, and the Texting System.

**See also:** [Getting Started Guide](01-getting-started.md)

### Deduplication
Preventing the same information from being processed multiple times. DF-Middleware uses deduplication to ensure webhooks aren't processed twice.

**Why it matters:** Prevents duplicate contacts, duplicate call records, and other duplicate data.

## E

### Event
Something that happens in a system. Examples: a contact is added, a call is made, a message is sent.

**In DF-Middleware:** Events trigger synchronization. When an event happens, DF-Middleware processes it and syncs information to other systems.

## G

### GoHighLevel (GHL)
Your main customer relationship management (CRM) system. Stores contacts, conversations, appointments, and tags.

**See also:** [Connected Systems: GoHighLevel](03-connected-systems.md#gohighlevel-ghl)

## I

### Integration
The connection between different systems that allows them to work together. DF-Middleware provides integrations between GoHighLevel, Aloware, Verity, and the Texting System.

**See also:** [Connected Systems Guide](03-connected-systems.md)

## M

### Mapping
A record that links the same person or thing across different systems. For example, a mapping might say "Contact #12345 in GoHighLevel = Contact #67890 in Aloware."

**Why it matters:** Mappings help DF-Middleware know which records to update when information changes in one system.

**See also:** [How It Works: Mapping](02-how-it-works.md#common-terms-explained)

### Merge
Combining information from different systems when there are differences. DF-Middleware uses merge rules to decide which information to keep when contacts have different data in different systems.

**Example:** If GoHighLevel has phone number 555-1234 and Aloware has 555-5678, merge rules determine which number to keep.

**See also:** [How It Works: Conflict Handling](02-how-it-works.md#what-happens-when-theres-a-conflict)

## O

### Opt-Out
When someone requests to stop receiving text messages. Common opt-out keywords include: STOP, STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT, OPT-OUT, OPTOUT.

**In DF-Middleware:** When someone opts out, all systems are automatically updated to prevent future messages.

**See also:** [Common Scenarios: When Someone Opts Out](04-common-scenarios.md#when-someone-opts-out)

## S

### Source of Truth
The system that has the "official" or "most accurate" version of information. When there's a conflict (like two different phone numbers), DF-Middleware knows which system to trust based on the source of truth configuration.

**Example:** If GoHighLevel is the source of truth for contacts, its contact information takes precedence when there are conflicts.

**See also:** [How It Works: Source of Truth](02-how-it-works.md#common-terms-explained)

### Sync / Synchronization
Keeping information the same across multiple systems. When systems are "in sync," they all have the same information.

**Example:** When you add a contact in GoHighLevel, synchronization makes it appear in Aloware and Verity automatically.

**See also:** [How It Works: What Synchronization Means](02-how-it-works.md#what-synchronization-means)

### Sync Workflow
An automated process that keeps data synchronized between systems. Sync workflows run automatically whenever data needs to sync.

**Types:** Contact sync, call sync, message sync, list sync.

**See also:** [Workflows Explained: Sync Workflows](05-workflows-explained.md#sync-workflows)

## T

### Texting System
Your SMS messaging system. Handles sending and receiving text messages, managing conversations, and handling opt-outs.

**See also:** [Connected Systems: Texting System](03-connected-systems.md#texting-system)

## V

### Verity
Your capital management platform. Handles investor relationships, financial data, and business operations related to capital management.

**See also:** [Connected Systems: Verity](03-connected-systems.md#verity)

### Voice Agent Workflow
An automated process that guides AI-powered phone calls. Voice agent workflows handle conversations, collect information, make decisions, and complete tasks during AI calls.

**See also:** [Workflows Explained: Voice Agent Workflows](05-workflows-explained.md#voice-agent-workflows)

## W

### Webhook
A notification sent from one system to another when something happens. Think of it like a doorbell - when something happens in a system, it "rings the doorbell" to let DF-Middleware know.

**Example:** When you add a contact in GoHighLevel, GoHighLevel sends a webhook to DF-Middleware saying "New contact created."

**See also:** [How It Works: Webhook](02-how-it-works.md#common-terms-explained)

### Workflow
A series of automated steps that happen in a specific order to complete a task. Think of it like a recipe - each step follows the previous one, and together they create the final result.

**Types:** Sync workflows, voice agent workflows, business process workflows.

**See also:** [Workflows Explained](05-workflows-explained.md)

## Business Terms vs. Technical Terms

### Business Terms (What You Use)

- **Contact** - A person in your system
- **Call** - A phone conversation
- **Message** - A text message
- **Tag** - A label/category for contacts
- **List** - A group of contacts for calling
- **Appointment** - A scheduled meeting
- **Opt-out** - When someone stops receiving messages

### Technical Terms (What DF-Middleware Uses)

- **Entity** - A thing in the system (contact, call, message, etc.)
- **Webhook** - A notification about an event
- **Mapping** - A link between records in different systems
- **Sync** - Keeping information the same across systems
- **Workflow** - An automated process
- **API** - How systems talk to each other

**Don't worry about technical terms** - DF-Middleware handles the technical details automatically. You just need to know the business terms.

## Acronyms Explained

### GHL
**GoHighLevel** - Your CRM system

### CRM
**Customer Relationship Management** - A system for managing customer relationships

### SMS
**Short Message Service** - Text messaging

### API
**Application Programming Interface** - How systems communicate with each other

### DNC
**Do Not Call** - When someone opts out of receiving calls or messages

### FAQ
**Frequently Asked Questions** - Common questions and answers

## Still Confused?

- **Check the [FAQ](07-faq.md)** for answers to common questions
- **Read [How It Works](02-how-it-works.md)** for detailed explanations
- **Review [Common Scenarios](04-common-scenarios.md)** for real-world examples
- **Contact IT support** if you need clarification

---

**Need more help?** Check the [Getting Started Guide](01-getting-started.md) or contact IT support.
