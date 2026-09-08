# Management App v2 — Product Authority

Date: 2026-09-08

## Product purpose

Build the smallest management operating system that lets an administrator manage managers, lets each manager manage direct-report employees, and keeps measurable work and two-way communication in one place.

The core model is:

**Manager → Employee → Initiative → KPI → Update ↔ Conversation**

Managers may also own initiatives themselves. Administrators manage the manager layer.

## Required capabilities

1. Administrator creates/updates managers and employees and assigns reporting relationships.
2. Manager sees only themselves and their direct reports.
3. Employee sees only themselves, their manager, and their own initiatives.
4. Manager or administrator creates an initiative for a person they manage.
5. Every new initiative is created with at least one KPI.
6. Additional KPIs may be added later.
7. KPI contains target, current value, unit, direction, cadence, status, and update history.
8. Employee and authorized management can update KPI progress.
9. Every initiative has a persistent two-way message thread.
10. Message and KPI-update events create email and/or SMS notifications according to the recipient's preferences.
11. Administrator can configure email/SMS notification preferences and mobile numbers.
12. Administrator can see failed delivery attempts and retry them.
13. Stale writes are rejected rather than silently overwriting current work.
14. Direct browser Firestore access is denied; the authenticated server API is authoritative.

## Navigation

- Overview
- My team
- Initiatives
- Messages
- Administration (admin only)

The UI should answer quickly:

- What is on track?
- What is at risk or blocked?
- Which person owns it?
- What changed recently?
- What conversation needs a response?

## Deliberate exclusions

V2 is not an HRIS, project-management suite, payroll system, performance-ranking system, or surveillance system. It excludes payroll, recruiting, compensation, timekeeping, AI employee scoring, predictive ranking, document management, and complex workflow engines.

Email and SMS are notification channels. The canonical two-way conversation remains the initiative thread so management context cannot fragment across private inboxes and phones.

## Production data boundary

The existing Firebase project `accelbusiness-hub` has other applications in its `(default)` Firestore database. V2 therefore supports `FIRESTORE_DATABASE_ID` and production should use a named database (recommended ID: `management-v2`). Its deny-all browser rules must never be deployed over the shared default database.
