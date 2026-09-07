/**
 * Formats a Date as "YYYY-MM-DD" using its LOCAL calendar date, not UTC.
 *
 * `d.toISOString().slice(0, 10)` looks equivalent but isn't: it converts
 * to UTC first. For a date built from `new Date(y, m, day)` at local
 * midnight that's harmless (still the same UTC calendar day), but for
 * "right now" - used as the default "to" date, and as a picker's default
 * value - it silently returns TOMORROW's date once local time is far
 * enough ahead of UTC (roughly after 7-8pm Eastern), since UTC has
 * already rolled into the next day by then.
 */
export function toDateInput(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
