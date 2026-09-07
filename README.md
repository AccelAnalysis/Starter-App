# AccelAnalysis Starter App

Two deliberately small Next.js starters for the two-hour app launch process.

- **Utility starter** — calculate, display, filter, or transform information without accounts or shared private data.
- **Data-backed starter** — authenticated users, protected per-user records, and persistent Firestore storage.

Both starters use Next.js App Router + TypeScript, the same responsive visual shell, ESLint, strict type checking, production builds, and an `APP_BRIEF.md` scope contract.

## Create a new app

Requires Node.js 20.9 or newer.

```bash
git clone https://github.com/AccelAnalysis/Starter-App.git
cd Starter-App

# Create a utility app
node scripts/create-starter.mjs utility ../my-utility-app

# Create an authenticated data app
node scripts/create-starter.mjs data-backed ../my-data-app
```

Then:

```bash
cd ../my-utility-app
npm install
npm run dev
```

The generator copies a standalone project and rewrites its package name from the destination folder.

## Verify before release

Utility starter:

```bash
npm run verify
```

Data-backed starter:

```bash
npm run verify
```

The data-backed verification includes Firestore security-rule tests against the Firebase emulator.

## Two-hour sprint defaults

1. **0–20 min:** complete `APP_BRIEF.md` and freeze scope.
2. **20–30 min:** initialize the app and get a live preview working.
3. **30–70 min:** implement one complete input → action → result workflow.
4. **70–95 min:** stop features; run tests and repair blockers.
5. **95–110 min:** release and verify production.
6. **110–120 min:** record the release and preserve contingency time.

Do not weaken authentication, authorization, validation, or data protection to meet the clock.

## Repository layout

```text
utility-starter/       Standalone public utility template
data-backed-starter/   Standalone Firebase Auth + Firestore template
scripts/                Starter copy/generation helper
.github/workflows/      Verification for both templates
```

## Version baseline

This starter set targets Next.js 16.3.x, React 19.2.x, and Firebase JS 12.18.x. Update dependencies intentionally and rerun verification before changing the baseline.
