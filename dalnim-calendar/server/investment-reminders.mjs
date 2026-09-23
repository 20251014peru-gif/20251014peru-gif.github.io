import {mapCheckToEvent, mapReviewToEvent} from './investment-feed.mjs';
// Which checks[]/reviewAt items from the investment archive are due on a given day (Asia/Seoul
// date string). Used by the twice-daily push sweep in server/index.mjs — these items are never
// stored as real calendar events (see investment-feed.mjs), so the ordinary per-event reminder
// sweep can't see them; this is a separate, read-only notification path for the same data.
export function dueInvestmentItems(records, todayStr) {
  const checks = (records || []).flatMap(r => (r.checks || []).map((c, i) => mapCheckToEvent(r, c, i))).filter(Boolean);
  const reviews = (records || []).map(mapReviewToEvent).filter(Boolean);
  return [...checks, ...reviews].filter(e => e.start === todayStr);
}
