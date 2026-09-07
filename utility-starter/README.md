# Utility Starter

Use this starter when the app can deliver its promised result without user accounts, shared private records, or privileged server-side secrets.

The included example accepts a list, filters it, optionally removes duplicates, and sorts the result. Replace `lib/utility.ts` and the workbench UI with the app-specific workflow.

## Start

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Before building

Complete `APP_BRIEF.md`. Keep version one to one user, one problem, and one complete input → action → result workflow.

## Quality gates

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Or run all gates:

```bash
npm run verify
```

## Deploy

Create a preview deployment first. On Vercel, import the generated app repository and use the default Next.js settings. Verify the actual preview URL before promoting or deploying to production.

## Upgrade to the data-backed starter when

- users need accounts;
- records must persist across devices;
- users must not see one another’s data;
- the app collects private data that needs explicit access control.

Do not add authentication or a database merely because they might be useful later.
