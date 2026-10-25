## What changed

Implemented cron modules

Generated weekly nudges with tests

## Why

The cron modules with the weekly nudges must be there for the assistant to prompt nudges, which stay open after the client contacts someone mid-week until the week ends or it is dismissed by the client. Tests are necessary as well to validate the nudges.

## How I tested
- [x] `pnpm --filter @nudge/web test`

All 4/4 cron auth tests passed.

## Notes / screenshots

<img width="508" height="113" alt="Cron and crypto tests passed" src="https://github.com/user-attachments/assets/a1f11d93-8f76-495e-a4c5-388e94cebbdd" />



