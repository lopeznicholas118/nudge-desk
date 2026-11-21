# Nudge Desk – Your personal-network assistant

Nudge Desk is a personal-network agent that syncs your Google Calendar and manual contacts, ranks who you’re overdue to contact, drafts a message in your voice (English or Spanish), and puts the draft in an approval queue so nothing sends without **you**.

The deployment link is available [here](https://nudge-desk-seven.vercel.app/login).

### Note:

Testing-mode OAuth apps are limited to test users, and Google expires refresh tokens for them after about 7 days.

Weeks are UTC ISO weeks (Monday start)

### Known limitations:

Events in the past that are later cancelled or deleted aren’t removed. Only the upcoming window is refreshed wholesale. 
Upserts keep past data stable and idempotent.
The judge runs at the API’s default sampling temperature, so its verdicts carry noise. Calibration measures this, but a fixed seed or temperature would be better.
The agent and judge are from the same model family, which can favor the agent’s own style. A different judge family would be a stronger check.
Grounding catches invented capitalized names and numbers, not invented lowercase facts. The judge’s specificity score is the backstop.
Fixtures are synthetic and small (nine cases). Real failure modes will come from real usage, so promote them into cases as you see them.
The evals use the in-memory store. The Supabase adapter’s data scoping is covered by integration tests, but its behavior under a real model is not.
Edit ratio excludes translated drafts, and a draft that is translated and then edited can’t be distinguished from a rewrite.
Translation quality isn’t evaluated.

### Out of scope for v1:

No Gmail – its scopes are restricted and require a costly security review.

### What I'd do next:

Fan out one queued job per user instead of having a duration limit for starting new users after about 25 seconds.
Add translation that is rate-limited or metered and logged to agent_runs.
As of now, open nudges from past weeks stay open in the database and are simply hidden. An expiry job would tidy them.
Older banners still display arbitrary text from the URL. The new actions use codes, and a cookie-based flash message would be the proper fix.
Add database-level state machine for drafts beyond the query guards and the function.
Production migrations are pushed by hand. A workflow_dispatch deploy job with Supabase secrets would automate it.
Google connect isn’t testable on previews. A stable staging domain registered with Google would fix that.
Sentry has no alert rules yet, and the debug pages have no pagination.
