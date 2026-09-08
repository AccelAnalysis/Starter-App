# Management Plan & Feedback Tool

A small, secure management workspace derived from `AccelAnalysis/Starter-App/data-backed-starter` at commit `6aec779c227b4b71d5ef17c7f1742f7de0b3baec`. Both reusable starter directories remain unchanged.

**The product loop:** establish a plan → assign measurable expectations → report progress → submit structured feedback → conduct review → record decision → assign follow-up → submit evidence → manager verifies → begin the next cycle.

## Implemented release scope

- Email/password Firebase authentication, verified email, approved membership, administrator bootstrap, session-only browser authentication, password reset.
- Organization, function, and individual plans in one architecture. Role-specific overview, My Plan, People, and one tabbed plan workspace.
- Responsibilities, goals, KPIs, reporting frequency, result history, and status.
- Eight feedback categories, explicit visibility, required-response deadline, acknowledgements, response history, linked follow-up, and guarded resolution.
- Canonical follow-up and action records, owner, deadline, source, priority, optional KPI, progress, retained evidence, and manager verification.
- Recurring check-in records and a live review sheet. Every completion requires a decision and next review. No change, plan-purpose revision, follow-up, and executive escalation are supported.
- Immutable plan snapshots on material changes, participant acknowledgement, and append-only audit events.
- In-app assignment/change notifications and live due/overdue queues. No email-notification infrastructure is required.
- Admin-approved users, functional scope, settings, a default individual-plan template, and JSON export.

This is a **single-organization pilot**, bounded to 75 approved people and 50 plans. The server reads the workspace's canonical records inside a transaction before applying authorization. This deliberately favors a small, auditable implementation over enterprise query optimization. Migrate to indexed per-scope queries before large-scale use. Individual record history is never silently trimmed; oversized records reject further writes with a migration message.

## Run locally with Firebase emulators

Requires Node.js 22 and Java 21.

```bash
cd management-plan-tool
npm install
# Terminal one:
npm run emulators
# Terminal two: copy .env.example to .env.local and use the demo settings below
npm run dev
```

Local-only `.env.local`:

```dotenv
NEXT_PUBLIC_FIREBASE_API_KEY=demo-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=demo-management.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-management
NEXT_PUBLIC_FIREBASE_APP_ID=demo-app-id
NEXT_PUBLIC_USE_EMULATORS=true
MANAGEMENT_EMULATOR=true
FIREBASE_PROJECT_ID=demo-management
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
WORKSPACE_ID=management
BOOTSTRAP_ADMIN_EMAIL=your-email@example.test
BOOTSTRAP_ORG_NAME=My organization
```

Create the administrator account through Activate account. The Auth emulator prints its email-verification link in its console. Open that local link, then select Check access again. Production mode refuses emulator configuration. Test fixtures use fictional accounts only and are not shipped as production seed data.

## Verify

```bash
npm run lint
npm run typecheck
npm test
npm run test:rules
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
```

`npm run verify` includes lint, strict TypeScript, pure-domain tests, actual Auth/Firestore emulator security tests, and production build. Browser acceptance is a separate `test:e2e` gate. CI captures logs, browser traces, screenshots, and a source archive even if a gate fails. An authored test is not proof of a pass; inspect the workflow conclusion and artifacts.

## Production setup — do not use real employee data until complete

1. Create a **dedicated** Firebase project and web app, Firestore database, and enable Email/Password Auth. Configure password policy and authorized domains. Do not deploy these deny-all rules over an unrelated application's project.
2. Configure the public web-app values from `.env.example` on your Next.js host. Set `FIREBASE_PROJECT_ID`, `WORKSPACE_ID`, `BOOTSTRAP_ADMIN_EMAIL`, and organization name server-side.
3. Give the server narrowly scoped Firebase Auth/Firestore access using application default credentials on Google hosting, or a server-only secret `FIREBASE_SERVICE_ACCOUNT_JSON`. Never place this secret in `NEXT_PUBLIC_*` variables, source control, browser code, or logs. No private credentials are included in this repository.
4. Authenticate the Firebase CLI to the dedicated project and deploy rules: `npm run deploy:rules -- --project YOUR_PROJECT_ID`. The browser has no direct Firestore access; only the verified server API can access management records.
5. Run all verification gates, deploy the Next.js app, and test two employee accounts plus a manager in that environment. Confirm Employee A cannot retrieve Employee B's records through direct API requests.
6. The configured bootstrap administrator activates and verifies their email. Administration → create functions → approve manager/employee emails. Those people activate their own verified accounts from Sign In. The app does not send invitation emails automatically.
7. Establish an individual plan, create the first expectation, conduct a review, complete follow-up with evidence, and verify closure. Retest persistence after signing out and signing back in.
8. Configure backups, retention, monitoring, abuse controls, and incident ownership appropriate to the organization before broad rollout.

## Security boundary

`/api/workspace` authenticates every request with Firebase Admin token verification (including revocation/disabled-account checks) and verified-email membership. Read projection and every mutation check the authoritative member role, function, plan, visibility, and originating-record access. Firestore Security Rules deny **all** direct client reads/writes, including old starter paths. The Admin SDK bypasses Firestore rules by design, so the server authorization tests are mandatory, not optional.

Canonical records live under `managementWorkspaces/{workspace}/records/{kind}__{id}`. The workspace metadata revision serializes commands. Stale edits return HTTP 409 rather than overwriting another person's work. Review decisions and generated follow-ups commit atomically. No API command deletes audit or plan-version history.

Private notes are visible only to people involved and authorized management. Executive-only content is administrator-only. A follow-up inherits access restrictions from its source. Sharing a plan does not share private feedback attached to it. Notifications do not copy confidential note text.

## Intentional boundaries

- No payroll, recruiting, compensation, surveillance, employee ranking, AI performance scoring, enterprise chat, or full calendar sync.
- No document upload service; evidence is retained text with optional references/URLs.
- No automatic invitation emails, external notification scheduler, or automatic escalation without a human review decision.
- Plan scope and participant set are established at creation. Use a new plan for a changed reporting population; revisions preserve purpose, cadence, targets, and expectations.
- `Update Plan` within review revises the plan purpose with an explicit change summary. Detailed responsibility/KPI edits use Revise in Expectations and preserve their own version.
- The completed external Build Contract was not located in the starter or Library search. `APP_BRIEF.md` records the sprint scope but does not claim to replace, complete, or satisfy an unseen contract.

## Release status

This source is a release candidate, not evidence of a configured production service. The PR and CI results record executed verification. Production Firebase project selection, credentials, authorized domain, rules deployment, environment-specific acceptance, and the external Build Contract remain release gates until explicitly verified.
