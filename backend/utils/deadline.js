/**
 * Application deadlines are picked as a DATE ("2026-11-11"). Stored as midnight, a job would
 * disappear at the very start of its last day. We store the END of that day instead, so
 * "Apply by 11 Nov" means applications stay open until 11 Nov, 23:59.
 */
function deadlineEndOfDay(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const text = String(value);
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999);
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return d; // invalid: the caller reports it
  d.setHours(23, 59, 59, 999);
  return d;
}

module.exports = { deadlineEndOfDay };
