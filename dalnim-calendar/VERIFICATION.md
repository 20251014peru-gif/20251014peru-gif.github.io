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

## Desktop source workspace (0.14.0)

This frontend-only update uses the existing detail response and save API. Desktop opens a full-window three-column workspace (two columns for intermediate widths, a stacked layout on phones). Core result inputs remain beside the source and research plan, with per-column scrolling for long material. General personal/prediction editors retain their existing layout.

Source excerpts use exact offsets into the already stored body and display matched terms, preserving the text rather than generating a quotation. Repeated checklist questions and unrelated openings are excluded. The in-panel source reader opens and highlights that paragraph immediately; manual search and next-match navigation are available if matching fails. Selecting an excerpt for the claim field is an explicit draft edit and does not save until the user presses Save.

Timestamp links are emitted only for a known YouTube URL or the source app's yt_<11-character-video-id> identifier, with a bracketed time in the same excerpt or directly attached preceding line. No timestamp is inferred from dates, prices, distant timestamps, or subject similarity. Untimed summaries clearly label the ordinary video link as lacking a timestamp. Imported summaries may contain interpretations and are not represented as verified speaker quotations. Matching is limited to the source body supplied by the existing API (up to 20,000 characters), with a visible notice at that boundary.

ADI questions get company-specific official event/results links and instructions to compare the price range actually written in the question, without inventing an earnings date or market price. Existing saved research instructions and pattern names are preserved; default case grouping remains compatible with the deployed backend.

Validation: source-focus tests cover exact offsets, ranking, duplicate tasks, long text, empty matching, timestamp boundaries and HTML/URL safety. Synthetic browser checks exercise paragraph jumps, claim insertion, save/reopen and desktop/mobile layouts. No database migration or server deployment is needed for this frontend update.
