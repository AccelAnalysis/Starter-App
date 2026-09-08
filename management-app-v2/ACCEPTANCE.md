# Management App v2 — Acceptance

A release candidate is acceptable only when the same exact SHA passes:

## Static
- `git diff --check`
- ESLint
- strict TypeScript
- Next.js production build

## Domain
- admin creates manager and employee reporting relationships
- initiative creation requires one or more KPIs
- manager can assign KPI-backed initiatives to a direct report
- cross-manager assignment is rejected
- employee can update own KPI but not another reporting line
- initiative closure requires all KPIs complete
- message and KPI update events create the correct notification channels

## Authorization and persistence
- actual Firebase Auth/Firestore emulators
- unauthenticated requests rejected
- unverified/uninvited users rejected
- direct browser Firestore reads/writes denied
- peer employee isolation
- cross-manager isolation
- stale update returns HTTP 409
- manager-created initiative persists and becomes visible to its owner

## Browser
- actual first-time administrator activation and email-verification refresh path
- manager creates initiative with first KPI and adds another KPI
- employee updates KPI
- employee messages manager
- manager sees KPI context and replies
- employee receives the reply in the initiative thread
- admin sees manager/employee hierarchy
- peer employee does not see another employee's initiative/conversation
- mobile layout has no horizontal overflow
- no uncaught browser errors

## Notification delivery
CI disables external provider calls. Production acceptance separately verifies one real email delivery and one real SMS delivery using configured provider credentials.

## Release process
Freeze the candidate SHA while acceptance runs. Do not modify an in-progress release candidate. PASS, FAIL, and NOT EXECUTED are distinct states.
