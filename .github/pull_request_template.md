## What changed

Integrated Google Calendar OAuth

Included dashboard UI and syncing with a user's Google calendar

## Why

The Google Calendar OAuth with credentials in place allows the user to connect their Google calendar to Nudge Desk.
The system pulls contacts from the user, including contacts that they have not contacted in a long time.
The "close", "warm", and "weak" declarations for relationship are also included for the program to designate alerts based on the relationship type with the user.

## How I tested
- [x] `pnpm typecheck`
- [x] `pnpm lint`
- [x] `pnpm test`
- [x] `pnpm build`
- [x] `supabase test db`
- [x] `pnpm --filter @nudge/core test`
- [x] `pnpm --filter @nudge/web test`
- [x] `pnpm dev`

I verified the code from the dev website as shown in the image. I changed Claude's suggested black text to white text for readability.
Also, I troubleshot an AI error in TypeScript: a constant couldn't be defined under a Json due to it being an interface (SyncSummary) instead of a type. See `apps/web/lib/google/sync.ts`.

## Notes / screenshots

<img width="574" height="57" alt="supabase test db: 13/13 tests passed" src="https://github.com/user-attachments/assets/bac5eb19-0d5e-4244-8a7e-c6aa097e5d10" />
<img width="512" height="144" alt="pnpm test: all tests passed" src="https://github.com/user-attachments/assets/b2d3b1c1-788c-4422-be74-186bc033d68b" />
<img width="517" height="197" alt="encryption test passed" src="https://github.com/user-attachments/assets/d3218fb0-41eb-414f-9a83-0f2a27914c87" />
<img width="681" height="522" alt="dashboard demo" src="https://github.com/user-attachments/assets/fcfa081b-8156-44eb-ae5f-1a077e15e8ec" />

