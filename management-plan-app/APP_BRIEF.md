# Sprint scope contract — Management Plan & Feedback Tool

Date: 2026-09-07. Requested sprint: 60 minutes. Product brief: the user's 22-section Management Plan & Feedback Tool Development Brief. Starter baseline: data-backed-starter at 6aec779c227b4b71d5ef17c7f1742f7de0b3baec.

## Objective

Every management expectation has an owner, an explicit success measure, a cadence, a current status, a feedback path, and a documented next action. Prove the closed loop rather than a disconnected CRUD catalogue.

## Frozen scope

One organization; administrator, function-scoped manager, and employee. Nine navigation/workspace views: sign in, role-specific overview, management plans, tabbed plan workspace, My Plan, People, reviews/check-ins, follow-up queue, and administration. No separate page per data object.

Canonical typed records: organization; member/user/role and function; management plan; plan version; responsibility/goal/KPI through a discriminated Expectation record; KPIResult; ActionItem; Feedback; Meeting; Review; Decision; FollowUp; Acknowledgement; Notification; AuditEvent. Distinct records preserve their IDs and relations even when consolidated into one screen or collection.

Complete sequence: leader establishes plan, assigns measurable expectation; employee sees and updates it; feedback is submitted and answered; review assembles relevant records; manager records decision; decision or feedback generates paired follow-up/action; employee submits evidence; manager verifies; feedback resolves; next review begins; revised expectations retain prior snapshots.

## Deliberate simplifications

- Single-organization pilot, maximum 75 members and 50 plans, configurable functions and explicit participants at plan creation.
- One server API rather than client Firestore queries. Firebase Admin token checks and per-record policy are mandatory; Firestore client access is denied universally.
- Text/reference evidence instead of file storage.
- Date-level recurring reviews rather than full calendar scheduling.
- In-app notifications and computed due queues instead of external email infrastructure.
- One default individual-plan template; purpose/cadence/horizon are editable before creation.
- No HRIS, payroll, benefits, recruitment, timekeeping, surveillance, AI scoring, or predictive ranking.

## Acceptance gates

1. Static quality: ESLint, strict TypeScript, production build.
2. Domain: plan and target versioning; immutable historical records; ownership and scope; feedback lifecycle; atomic review decisions/follow-up; evidence and manager verification; acknowledgement ownership; automatic overdue calculation.
3. Backend: actual Firebase Auth/Firestore emulators; unauthenticated/unverified/uninvited/disabled denials; employee cross-access and escalation denials; deny-all direct Firestore paths; successful persistence; stale-command rejection.
4. Browser: actual authenticated desktop workflow across executive, manager and employee; feedback-to-follow-up-to-evidence closure; review decision; plan revision; peer isolation; mobile horizontal-overflow check; runtime error check; screenshots.
5. Production: dedicated Firebase configuration, safe rules deployment, approved domain, live access tests, backups/retention/abuse controls, and release approval.

## Authority and release

No completed external Build Contract was available in the repository listing or relevant Library search. This file is a scope/acceptance mapping, not a substitute for that contract. Do not claim contract acceptance or production readiness without reconciling it. Preserve the starter's requirement not to weaken authorization to meet the clock.
