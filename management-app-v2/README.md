# Management App v2

A focused management operating system for **manager → employee → initiative → KPI → update ↔ conversation**.

V2 intentionally replaces the broader Management Plan model with a smaller workflow that is easier to set up and use:

- administrators manage managers and reporting relationships;
- managers own direct-report employees;
- managers assign initiatives to themselves or their direct reports;
- every initiative starts with at least one KPI;
- employees and authorized management update KPI progress;
- every initiative has one durable two-way conversation thread;
- email and SMS notifications keep the other side aware of assignments, KPI updates, and messages;
- the application itself remains the canonical communication record.

## Local preview

Requires Node.js 22 and Java 21.

```bash
cd management-app-v2
npm install
cp .env.example .env.local
```

Use this local `.env.local`:

```dotenv
NEXT_PUBLIC_FIREBASE_API_KEY=demo-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=demo-management-v2.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-management-v2
NEXT_PUBLIC_FIREBASE_APP_ID=demo-app-id
NEXT_PUBLIC_USE_EMULATORS=true

MANAGEMENT_EMULATOR=true
FIREBASE_PROJECT_ID=demo-management-v2
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
WORKSPACE_ID=management-v2
BOOTSTRAP_ADMIN_EMAIL=admin@example.test
BOOTSTRAP_ORG_NAME=Example Organization
NOTIFICATIONS_DISABLED=true
```

Terminal one:

```bash
npm run emulators
```

Terminal two:

```bash
npm run dev
```

Then open `http://localhost:3000`.

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run test:rules
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
```

The browser acceptance includes the real first-time administrator activation path: create account → email becomes verified → refresh Firebase token → bootstrap workspace. This is deliberately included because that path was not covered adequately in v1.

## Notifications

Outbound email uses the Resend REST API when these server-side values are configured:

```dotenv
RESEND_API_KEY=...
NOTIFICATION_FROM_EMAIL=Management <management@example.com>
```

Outbound SMS uses Twilio Messaging when these server-side values are configured:

```dotenv
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+17575551234
```

Set the public application URL so notification links return directly to the initiative:

```dotenv
APP_BASE_URL=https://management.example.com
```

Provider credentials are never `NEXT_PUBLIC_*` values. CI and local test mode use `NOTIFICATIONS_DISABLED=true`, so automated tests never contact a real email or SMS provider.

## Firebase production boundary

The intended Firebase project is `accelbusiness-hub`. Its `(default)` Firestore database already contains data for other applications, so **do not deploy V2's deny-all rules over that shared default database**.

V2 accepts:

```dotenv
FIREBASE_PROJECT_ID=accelbusiness-hub
FIRESTORE_DATABASE_ID=management-v2
WORKSPACE_ID=management-v2
BOOTSTRAP_ADMIN_EMAIL=jholman@accelanalysis.com
BOOTSTRAP_ORG_NAME=Accel Analysis
```

`firebase.production.json` scopes the V2 rule deployment to the named `management-v2` database. After that database exists, the intended command is:

```bash
firebase deploy \
  --only firestore:management-v2 \
  --config firebase.production.json \
  --project accelbusiness-hub
```

The default database and its existing applications should remain untouched.

**Production note:** the Firebase Admin Node API for selecting a named Firestore database is currently documented by Firebase as a preview API. V2 contains the named-database adapter because it is the cleanest way to preserve the existing `accelbusiness-hub` default database, but do not treat that storage choice as production-approved until the currently supported Firebase deployment/runtime path is confirmed. If production policy requires only generally available Admin APIs, use a dedicated Firebase project instead of putting management data into the shared default database.

## Security model

Browser clients use Firebase Authentication only. Management records are never fetched directly through the Firestore browser SDK.

```text
Verified Firebase user
        ↓
/api/workspace
        ↓
role + reporting-line + initiative authorization
        ↓
Firebase Admin
        ↓
Firestore
```

The Firestore rules included with V2 deny direct browser reads and writes. Managers cannot cross reporting lines. Employees cannot see peer initiatives or peer conversations. Notifications are filtered through the same initiative visibility boundary so notification text cannot broaden private management access.

## Data model

V2 has six persistent record families:

- members
- initiatives
- KPIs
- KPI updates
- messages
- notifications

There is no separate review/decision/follow-up object graph. KPI progress and the initiative conversation are the operating record.

## Source status

A merged source build is not the same as production acceptance. Before real employee use, configure the actual Firebase web app, production data boundary, email/SMS provider credentials, authorized domains, and run one live manager/employee isolation test plus one real email and SMS delivery test.
