# Nudge Desk – Your personal-network assistant

Nudge Desk is a personal-network agent that syncs your Google Calendar and manual contacts, ranks who you’re overdue to contact, drafts a message in your voice (English or Spanish), and puts the draft in an approval queue so nothing sends without **you**.

As of now, Nudge Desk is a work-in-progress.
When it is completed and deployed, the deployment link will be available.

### Note:

Testing-mode OAuth apps are limited to test users, and Google expires refresh tokens for them after about 7 days.

### Known limitations:

Events in the past that are later cancelled or deleted aren’t removed. Only the upcoming window is refreshed wholesale. 
Upserts keep past data stable and idempotent.

### Out of scope for v1:

No Gmail – its scopes are restricted and require a costly security review.
