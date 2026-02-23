# Common Scenarios and Use Cases

This guide walks you through real-world scenarios to show you exactly what happens when you perform common tasks. Each scenario explains what you do, what DF-Middleware does automatically, and what to expect.

## When a New Contact is Added

### What You Do

You add a new contact "Sarah Johnson" in GoHighLevel with:
- Name: Sarah Johnson
- Phone: 555-1234
- Email: sarah@example.com

### What Happens Automatically

1. **GoHighLevel** stores Sarah's information
2. **DF-Middleware** receives a notification: "New contact created"
3. **DF-Middleware** automatically:
   - Creates Sarah in Aloware (so you can call her)
   - Creates Sarah in Verity (if applicable)
   - Adds Sarah to the texting system (so you can text her)
   - Creates a mapping to remember Sarah exists in all systems
4. **Result:** Sarah now appears in all systems within seconds

### What to Expect

- ✅ Sarah appears in GoHighLevel immediately
- ✅ Sarah appears in Aloware within seconds
- ✅ Sarah appears in Verity within seconds (if configured)
- ✅ You can call, text, or manage Sarah from any system

### Time Frame

- **Immediate:** Contact appears in the system where you added it
- **Within seconds:** Contact appears in other systems automatically

---

## When a Call is Made

### What You Do

You make a call to Sarah Johnson through Aloware. The call lasts 5 minutes, and you mark the outcome as "Interested - Follow up needed."

### What Happens Automatically

1. **Aloware** records the call with:
   - Who was called (Sarah Johnson)
   - When the call happened
   - How long it lasted
   - The outcome/notes
2. **DF-Middleware** receives a notification: "Call completed"
3. **DF-Middleware** automatically:
   - Finds Sarah in GoHighLevel (using the mapping)
   - Creates a call record in GoHighLevel
   - Links the call to Sarah's contact record
   - Adds the call notes/outcome to Sarah's history
4. **Result:** The call record appears in both Aloware and GoHighLevel automatically

### What to Expect

- ✅ Call record appears in Aloware immediately
- ✅ Call record appears in GoHighLevel within seconds
- ✅ Call is linked to Sarah's contact in GoHighLevel
- ✅ You can see the full call history in GoHighLevel

### Time Frame

- **Immediate:** Call record appears in Aloware
- **Within seconds:** Call record appears in GoHighLevel automatically

---

## When a Message is Sent

### What You Do

You send a text message to Sarah Johnson through the texting system: "Hi Sarah, following up on our call yesterday. Are you available for a meeting?"

### What Happens Automatically

1. **Texting System** sends the message and records it
2. **DF-Middleware** receives a notification: "Message sent"
3. **DF-Middleware** automatically:
   - Finds Sarah in GoHighLevel (using the mapping)
   - Creates a conversation thread in GoHighLevel (if one doesn't exist)
   - Adds your message to Sarah's conversation history
   - May sync to Aloware (if configured)
4. **Result:** The message appears in GoHighLevel's conversation history automatically

### What to Expect

- ✅ Message is sent through the texting system
- ✅ Message appears in GoHighLevel conversation history within seconds
- ✅ Message is linked to Sarah's contact record
- ✅ You can see the full conversation thread in GoHighLevel

### Time Frame

- **Immediate:** Message is sent
- **Within seconds:** Message appears in GoHighLevel automatically

---

## When a Message is Received

### What You Do

Sarah Johnson replies to your text: "Yes, I'm available! How about Tuesday at 2pm?"

### What Happens Automatically

1. **Texting System** receives the message and records it
2. **DF-Middleware** receives a notification: "Message received"
3. **DF-Middleware** automatically:
   - Finds Sarah in GoHighLevel (using the mapping)
   - Adds Sarah's reply to the conversation thread
   - Updates the conversation timestamp
   - May sync to Aloware (if configured)
4. **Result:** Sarah's reply appears in GoHighLevel's conversation history automatically

### What to Expect

- ✅ Message is received through the texting system
- ✅ Message appears in GoHighLevel conversation history within seconds
- ✅ Message is linked to the existing conversation thread
- ✅ You can see the full conversation in GoHighLevel

### Time Frame

- **Immediate:** Message is received
- **Within seconds:** Message appears in GoHighLevel automatically

---

## When an Appointment is Booked

### What You Do

You schedule an appointment with Sarah Johnson in GoHighLevel for Tuesday at 2pm.

### What Happens Automatically

1. **GoHighLevel** creates the appointment and links it to Sarah's contact
2. **DF-Middleware** receives a notification: "Appointment created"
3. **DF-Middleware** automatically:
   - May sync appointment details to other systems (depending on configuration)
   - Updates contact information if needed
4. **Result:** Appointment is stored in GoHighLevel and may sync to other systems

### What to Expect

- ✅ Appointment appears in GoHighLevel immediately
- ✅ Appointment is linked to Sarah's contact record
- ✅ Appointment may sync to other systems (depending on configuration)

### Time Frame

- **Immediate:** Appointment appears in GoHighLevel
- **Within seconds:** May sync to other systems (if configured)

**Note:** Appointment syncing depends on your specific configuration. Contact IT if you need details about appointment syncing in your setup.

---

## When a Contact is Reassigned

### What You Do

You reassign Sarah Johnson from "Sales Team" to "Support Team" in GoHighLevel.

### What Happens Automatically

1. **GoHighLevel** updates Sarah's assignment/tag
2. **DF-Middleware** receives a notification: "Contact updated"
3. **DF-Middleware** automatically:
   - Updates Sarah's information in Aloware
   - Updates Sarah's information in Verity (if applicable)
   - May update list memberships in Aloware based on tags
4. **Result:** Sarah's assignment/tag updates across all systems automatically

### What to Expect

- ✅ Assignment/tag updates in GoHighLevel immediately
- ✅ Assignment/tag updates in Aloware within seconds
- ✅ Assignment/tag updates in Verity within seconds (if configured)
- ✅ List memberships may update in Aloware automatically

### Time Frame

- **Immediate:** Update appears in GoHighLevel
- **Within seconds:** Updates appear in other systems automatically

---

## When Someone Opts Out

### What You Do

Sarah Johnson sends a text message saying "STOP" to opt out of receiving text messages.

### What Happens Automatically

1. **Texting System** receives the "STOP" message
2. **DF-Middleware** receives a notification: "Opt-out request"
3. **DF-Middleware** automatically:
   - Finds Sarah in all systems (using mappings)
   - Marks Sarah as "opted out" in the opt-out registry
   - Updates Sarah's status in GoHighLevel (adds opt-out tag)
   - Updates Sarah's status in Aloware (marks as do-not-call if applicable)
   - Updates Sarah's status in Verity (if applicable)
   - Prevents future text messages from being sent
4. **Result:** Sarah is marked as opted out in all systems automatically

### What to Expect

- ✅ Opt-out is detected immediately
- ✅ Sarah is marked as opted out in all systems within seconds
- ✅ Future text messages are blocked automatically
- ✅ Sarah's contact record shows opt-out status

### Time Frame

- **Immediate:** Opt-out is detected
- **Within seconds:** Opt-out status updates in all systems automatically

### Important Notes

- **STOP keywords:** The system recognizes various opt-out keywords: STOP, STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT, OPT-OUT, OPTOUT
- **Automatic blocking:** Once opted out, the system automatically prevents future messages
- **System-wide:** Opt-out status applies across all systems

---

## When a Contact is Tagged

### What You Do

You add a tag "Hot Lead" to Sarah Johnson's contact in GoHighLevel.

### What Happens Automatically

1. **GoHighLevel** adds the tag to Sarah's contact
2. **DF-Middleware** receives a notification: "Tag added"
3. **DF-Middleware** automatically:
   - May create a corresponding list in Aloware (if configured)
   - May add Sarah to an existing list in Aloware
   - Updates contact information in other systems
4. **Result:** Tag is added in GoHighLevel and may create/update lists in Aloware automatically

### What to Expect

- ✅ Tag appears in GoHighLevel immediately
- ✅ Tag may create a list in Aloware (if configured)
- ✅ Sarah may be added to a call list in Aloware automatically

### Time Frame

- **Immediate:** Tag appears in GoHighLevel
- **Within seconds:** List may be created/updated in Aloware automatically

**Note:** Tag-to-list syncing depends on your specific configuration. Contact IT if you need details about tag syncing in your setup.

---

## When Contact Information is Updated

### What You Do

You update Sarah Johnson's phone number in GoHighLevel from 555-1234 to 555-5678.

### What Happens Automatically

1. **GoHighLevel** updates Sarah's phone number
2. **DF-Middleware** receives a notification: "Contact updated"
3. **DF-Middleware** automatically:
   - Finds Sarah in Aloware (using the mapping)
   - Updates Sarah's phone number in Aloware
   - Updates Sarah's phone number in Verity (if applicable)
   - Updates Sarah's phone number in the texting system
   - Updates the mapping record
4. **Result:** Sarah's phone number is updated in all systems automatically

### What to Expect

- ✅ Phone number updates in GoHighLevel immediately
- ✅ Phone number updates in Aloware within seconds
- ✅ Phone number updates in Verity within seconds (if configured)
- ✅ Phone number updates in texting system within seconds

### Time Frame

- **Immediate:** Update appears in GoHighLevel
- **Within seconds:** Updates appear in other systems automatically

### Conflict Handling

If Sarah's phone number was different in Aloware (e.g., 555-9999), DF-Middleware will:
- Check the source of truth configuration
- Apply merge rules to determine which number to keep
- Update both systems with the correct number
- Log the conflict for reference

---

## Summary: What to Expect

### General Expectations

- ✅ **Automatic syncing** - Information flows automatically between systems
- ✅ **Fast updates** - Most syncs happen within seconds
- ✅ **Complete picture** - You can see all interactions regardless of which system you're using
- ✅ **No manual work** - You don't need to copy information between systems

### Common Patterns

1. **Add/Update in one system** → Appears in other systems automatically
2. **Action in one system** → Record appears in other systems automatically
3. **Change in one system** → Updates propagate to other systems automatically

### When to Check

- **If something doesn't sync within 5 minutes** → Check the [Troubleshooting Guide](06-troubleshooting.md)
- **If information seems incorrect** → Check the [Troubleshooting Guide](06-troubleshooting.md)
- **If you're unsure what synced** → Check the visual documentation at `/docs/visual`

## Next Steps

- **Read [Workflows Explained](05-workflows-explained.md)** to learn about automated processes
- **Check [Troubleshooting](06-troubleshooting.md)** if something doesn't work as expected
- **Review [FAQ](07-faq.md)** for answers to common questions

---

**Questions about a specific scenario?** Check the [FAQ](07-faq.md) or contact IT support.
