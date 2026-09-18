// Active days. A day counts when the player OPENS the camp or acts in it on a
// local calendar date later than the last counted one. Elapsed time never counts:
// active Monday and Thursday, nothing between, is active day 2.
//
// Counted days are kept as a DATE LIST, not just a number, so they can be audited:
//   * the list only grows forward — a clock set back cannot count a day twice;
//   * a rollback of more than one day (a clock that was set into the future, now
//     corrected) REVOKES every counted date after today. Farming days by moving the
//     clock forward therefore evaporates the moment the clock comes back. One day of
//     tolerance is kept for timezone travel; its worst case is a day counted early,
//     never an extra day.
//   * dates older than the list cap fold into `base`, so the count stays monotonic.

export const DATE_CAP = 60;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function localDate(ms) {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  if (y < 1970 || y > 9999) return '';
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function dayNumber(iso) {
  const [y, m, dd] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, dd) / 86400_000);
}

/**
 * Mutates `state.days`. Returns { counted, revoked: [dates] }.
 * Callers that keep other date-stamped progress (night visits, long returns)
 * must drop the same revoked dates — engine.revokeDates() does that.
 */
export function markActiveDetail(state, now) {
  const out = { counted: false, revoked: [] };
  if (!Number.isFinite(now)) return out;
  const today = localDate(now);
  if (!today) return out;
  const d = state.days;
  if (d.last && today < d.last && dayNumber(d.last) - dayNumber(today) > 1) {
    out.revoked = d.dates.filter((x) => x > today);
    d.dates = d.dates.filter((x) => x <= today);
    d.last = d.dates.at(-1) || '';
    d.count = d.base + d.dates.length;
  }
  if (d.last && today <= d.last) return out;
  d.dates.push(today);
  if (d.dates.length > DATE_CAP) { d.base += d.dates.length - DATE_CAP; d.dates = d.dates.slice(-DATE_CAP); }
  d.last = today;
  d.count = d.base + d.dates.length;
  out.counted = true;
  return out;
}

export function markActive(state, now) { return markActiveDetail(state, now).counted; }

export function activeDay(state) {
  return Math.max(1, state.days.count);
}

export function cleanDays(raw, fallbackCount = 0) {
  const o = raw && typeof raw === 'object' ? raw : {};
  const dates = [...new Set((Array.isArray(o.dates) ? o.dates : []).filter((x) => typeof x === 'string' && ISO.test(x)))].sort().slice(-DATE_CAP);
  let base = Number.isInteger(o.base) && o.base >= 0 ? Math.min(o.base, 100000) : 0;
  // v1.0 saves carried only {count, last}: keep the count as base, the last date as the list
  if (!Array.isArray(o.dates) && Number.isInteger(o.count) && o.count > 0) {
    const last = typeof o.last === 'string' && ISO.test(o.last) ? o.last : '';
    return { base: Math.min(o.count, 100000) - (last ? 1 : 0), dates: last ? [last] : [], last, count: Math.min(o.count, 100000) };
  }
  if (!Array.isArray(o.dates)) base = Math.min(Number.isInteger(fallbackCount) ? fallbackCount : 0, 100000);
  return { base, dates, last: dates.at(-1) || '', count: base + dates.length };
}
