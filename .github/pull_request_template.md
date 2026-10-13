## What changed

Incorporated login and dashboard auth on a proxy session

Integrated Supabase email/password auth on the database

## Why

For the user to access the nudge desk agent, they need to enter their credentials in a login page and they must be presented with a dashboard.
The Supabase database holds the client's credentials.

## How I tested
- [x] `pnpm typecheck`
- [x] `pnpm lint`
- [x] `pnpm test`
- [x] `pnpm build`
- [x] `supabase test db`
- [x] `pnpm --filter @nudge/core test`
- [x] `pnpm dev`

I verified the code from the dev website as shown in the image. I changed Claude's suggested black text to white text for readability.

## Notes / screenshots

<img width="1214" height="780" alt="Login page" src="https://github.com/user-attachments/assets/f3243a10-30d6-4bb6-90c2-e94bbe6f6292" />
