# Acceptance map

| User scenario | Implementation | Verification |
|---|---|---|
| Plan creation and authorized visibility | plan.create, readsPlan, viewFor | domain authority tests, backend employee-view test, browser executive plan creation |
| Employee sees their operating expectations | My Plan, assigned Expectation records | desktop employee workflow and mobile screenshot/overflow check |
| Employee A cannot retrieve Employee B's private content | token verification, membership, plan/sensitive/source policy, deny-all direct Firestore | actual Auth/Firestore emulator tests, peer browser test |
| Structured feedback persists with correct recipient/source | feedback.create, origin, visibility policy | domain and backend private-feedback lifecycle |
| Follow-up has owner, due date, source and visible state | distinct FollowUp + ActionItem linked atomically | domain graph assertions, API persistence test, browser follow-up assignment |
| Review surfaces goals/KPIs/open records | live review sheet and recorded reference set | domain review sheet assertions; browser current KPI and unresolved feedback assertions |
| Review always leads to an explicit outcome | required outcome, decision, nextReview | no-change/update/follow-up/escalation tests |
| Plan changes preserve expectations at that time | PlanVersion deep snapshots with version/date/author/summary | target revision test and UI version history |
| Completion retains evidence/user/time | submit evidence then manager-only verify | domain and API completion tests, browser verification |
| Follow-up cannot disappear when feedback is read | acknowledgement != resolution; pending action blocks resolution | domain lifecycle guards and API premature-resolution rejection |
| Concurrency cannot silently overwrite work | transaction metadata revision, HTTP409 | simultaneous API command test |
| Roles cannot be changed from an employee client | member.save administrator check | direct crafted API privilege-escalation test |

Authored tests are not a pass certificate. CI run conclusions and uploaded test outputs are the execution evidence. No live-production acceptance is asserted by this document.
