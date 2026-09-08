# Management Plan App Rebuild

Date: 2026-09-07

This directory is the clean rebuild of the Management Plan & Feedback Tool after PR #3 established the known-good architecture and acceptance baseline.

## Rebuild strategy

The rebuild intentionally begins from the exact source tree that passed PR #3 rather than re-implementing already-correct domain and authorization behavior. The error-reduction change is the build and verification sequence:

1. Freeze the product authority: APP_BRIEF, role/function scope, visibility/source-chain rules, lifecycle rules, concurrency policy, and metrics definitions.
2. Preserve the server-authoritative security spine: Firebase Auth -> verified membership -> server API -> role/function/visibility/source-chain authorization -> Firebase Admin -> Firestore; direct browser Firestore remains deny-all.
3. Prove the secure vertical slice across the entire stack before extending behavior.
4. Extend the closed management loop one link at a time: plan -> expectation -> progress -> feedback -> review -> decision -> follow-up -> evidence -> verification -> next review.
5. Keep static, domain, authorization, browser, and environment verification conceptually separate.
6. Treat CI infrastructure failure as NOT EXECUTED, not as application evidence.
7. Freeze a release-candidate SHA while acceptance is running; any later code change creates a new candidate.
8. Merge only the exact SHA that passed application acceptance and starter-template regression verification.

## Known defects that must not be reintroduced

- Do not rely on ordinary runtime helpers to narrow nullable security-critical TypeScript values; use explicit compiler-recognized control flow or assertion signatures.
- Do not authorize only the requested record; traverse protected source relationships so private reviews/feedback cannot leak through meetings, decisions, or follow-ups.
- Do not use page-global Playwright selectors for repeated action labels; scope selectors to the record/container.
- Do not treat plan closure as a generic status write; preserve unresolved-work, evidence, review, audit, and history semantics.
- Do not use silent last-write-wins; mutable aggregates use revisions and stale commands return HTTP 409.
- Reset protected client state across identity changes in the same browser.
- Define every management metric by numerator, denominator, included/excluded statuses, date/timezone rule, cancellation behavior, and boundaries before dashboard use.

## Verification authority

Source acceptance is established only when the exact candidate SHA passes:

- `git diff --check`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run test:rules`
- `npm run build`
- `npm run test:e2e`
- Utility Starter regression
- Data-Backed Starter regression

Production remains a separate phase requiring a dedicated Firebase project, production credentials/domain, deployed deny-all client rules, backups/retention/monitoring, and live multi-user isolation/persistence acceptance before real employee data is used.
