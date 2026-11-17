# Mobile update 16 — unfinished, not deployed

Base: 607ffbb18de3c72f86e90e4ce13ba7dfad9adc8d
Branch purpose: preserve work after the execution environment became unavailable on 2026-11-18 (Asia/Seoul). Main/production has not been updated by this draft.

## Prepared changes
- Hide capture/photo/save footer while the mobile keyboard is visible; retain top Close.
- Use two large category columns on phones.
- Rename the unclear normal-note action to "할 일 해제", with a consistent two-column menu and deadline row.
- Initialize phone UI both before and after qm-ready. The prior late-loaded module could miss this event, leaving earlier contact-picker handlers installed.
- Split selected contact name and telephone into their respective fields, support array/string responses and missing properties, save only if the same note is still active.
- Format mobile phone numbers with hyphens; keep tel links sanitized.
- Add computed Quill link formatting and explicit open-link/map buttons while preserving plain-text storage.

## Checks actually completed
- JavaScript syntax compilation of changed modules and inline script.
- Four pure phone-format cases.
- No browser, IndexedDB, contact-picker, Quill rendering, keyboard, integration or regression tests could run after environment loss.
- Do not merge or deploy before these checks.

## Still required
1. Verify keyboard visibility/scroll behavior on Android Chrome and iPhone Safari. Verify footer returns when keyboard closes.
2. Reproduce delayed phone-ui loading and check native contact selection, cancellation, permission restrictions, partial/multiple phone values, name preservation, autosave and encryption.
3. Verify typed and pasted URL detection, Korean address map links, IME composition/caret stability, safe schemes, clearing of private text/link previews on lock.
4. Implement photo annotations: circle creation/move/resize, independently draggable arrow endpoints (free direction), draggable text and text-size controls; undo/delete selected annotation.
5. Save annotated photos as a new image copy, preserve originals, and update the same note. For private notes, encrypt with QMVault before IndexedDB/Drive persistence. Do not store private rendered output as plaintext.
6. Test annotations on touch/pinch/zoom, resize/orientation, full-resolution JPEG output, photo sharing, note synchronization and gallery refresh.
7. Bump/precache any added annotation scripts, rerun existing sync/privacy tests, deploy only to quickmemo-drive after verification.

## Safety constraints retained
No Firebase or other app changes. No user notes/photos were read or modified during this draft. No password, token or recovery mechanism added. Existing no-recovery encryption remains in place.
