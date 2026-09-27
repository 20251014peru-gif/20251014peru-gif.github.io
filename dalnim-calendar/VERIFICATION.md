# 확인·복기 근거 기록 (0.13.0)

Follow-up details now distinguish the saved question/expectation, current source text, editable research instructions, actual evidence, comparison, and reusable lessons. Topic prompts are deterministic drafts, never extracted quotations, fetched market results, or investment advice. Missing claims/periods stay blank.

## Storage and compatibility

- Source `record_followups` remains authoritative. Existing result, basisDate, links, comparison, judgment, changeReason, observedChange, lesson, and nextAction fields use the source contract.
- Optional `verificationPlan` version 1 contains claim, targetPeriod, findWhat, whereToLook, compareWith, criteria, and patternKey. Existing source edits retain it through the pinned transition's current-document spread. The archive UI still edits its existing fields; the calendar edits these extra instructions.
- Each save appends a full `record_followup_reviews` snapshot containing the plan and result. Retries with the same operation ID do not rewrite history. Stale revisions return 409 with draft preserved for explicit comparison.
- No migration, original-record write, new external service, or reminder policy change. Completed/paused follow-ups still cancel matching reminders atomically.

## Read path

Owner-only POST `/investment-items/detail` resolves the latest item, then separately reads up to 20 linked source records, the latest 20 saved revisions, and up to 20 completed cases with a nonempty result and the exact same pattern name. Total counts are displayed. Topics with no specific recognized guide get no automatic pattern name. Case grouping is a browse aid, not a statistical similarity model or return forecast.

Optional reads fail independently and show warnings rather than a successful empty state. Source HTML is escaped; evidence links require http(s) and exclude credentials. The ordinary resolve path used by reminder jobs does not fetch histories or source bodies. Histories and case queries reject collections over 5,000 items rather than silently truncating.

## Deployment and validation

Deploy the existing Firebase codebase before publishing the frontend, because it requires the new detail route. No rules, credentials, or indexes change. Shell cache v33 and entry URLs v0.13.0 refresh old browsers.

Run `node --test tests/*.test.mjs`. Verification tests cover input validation, retries, conflicts, source-app preservation, immutable review snapshots, atomic failure, grouping, missing sources, and independent read failures. UI QA uses isolated synthetic records, including save/reopen, revision history and responsive layouts.
