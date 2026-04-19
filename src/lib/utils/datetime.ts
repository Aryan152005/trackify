/**
 * IST-centric datetime helpers.
 *
 * WIS is an India-focused app — all user-entered clock times are IST.
 * The bugs this file exists to prevent:
 *   - `new Date("2026-04-20T09:00")` interprets the string in the *runtime's*
 *     timezone. On Vercel (UTC) that's 09:00Z; in a browser set to IST it's
 *     03:30Z. Same user input, two different stored instants.
 *   - Server Components `format(d, "h:mm a")` (date-fns) formats in the
 *     server's timezone (UTC on Vercel), displaying reminders 5.5h off.
 *
 * Always go through these helpers for reminder/task/notification times.
 */

export const IST_OFFSET = "+05:30";
export const IST_TZ = "Asia/Kolkata";

/**
 * Convert a `<input type="datetime-local">` value (e.g. "2026-04-20T09:00")
 * to a UTC ISO string, interpreting the input as IST regardless of the
 * runtime's timezone.
 */
export function istLocalToUtcISO(localDateTime: string): string {
  if (!localDateTime) throw new Error("localDateTime is required");
  // Accept "YYYY-MM-DDTHH:MM" or "YYYY-MM-DDTHH:MM:SS"
  const hasSeconds = /T\d{2}:\d{2}:\d{2}/.test(localDateTime);
  const withSeconds = hasSeconds ? localDateTime : `${localDateTime}:00`;
  return new Date(`${withSeconds}${IST_OFFSET}`).toISOString();
}

/**
 * Convert a UTC ISO string back to a `<input type="datetime-local">`
 * value representing the same instant in IST. Use this to pre-fill edit
 * forms so the user sees the same wall-clock time they entered.
 */
export function utcISOToIstLocalInput(iso: string): string {
  // Intl gives us the IST wall-clock parts; assemble into "YYYY-MM-DDTHH:MM"
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const lookup = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${lookup("year")}-${lookup("month")}-${lookup("day")}T${lookup("hour")}:${lookup("minute")}`;
}

/**
 * Format a date/ISO-string as IST wall-clock time.
 * Default format: "Apr 20, 2026 at 9:00 AM" (en-IN).
 */
export function formatIST(
  date: Date | string,
  opts?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-IN", {
    timeZone: IST_TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    ...opts,
  });
}

/** Just the IST time portion, e.g. "9:00 AM". */
export function formatISTTime(date: Date | string): string {
  return formatIST(date, {
    month: undefined,
    day: undefined,
    year: undefined,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Just the IST date portion, e.g. "Apr 20, 2026". */
export function formatISTDate(date: Date | string): string {
  return formatIST(date, {
    hour: undefined,
    minute: undefined,
    hour12: undefined,
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** "Apr 20, 2026, 9:00 AM IST" — useful in admin views. */
export function formatISTFull(date: Date | string): string {
  return `${formatIST(date)} IST`;
}

/** IST "YYYY-MM-DD" for a given instant (for date-only comparisons). */
export function istDateKey(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const lookup = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${lookup("year")}-${lookup("month")}-${lookup("day")}`;
}

/**
 * Build a UTC ISO timestamp for an IST date + time pair.
 * dateStr: "YYYY-MM-DD", timeStr: "HH:MM" (24h) or "HH:MM:SS".
 */
export function istDateTimeToUtcISO(dateStr: string, timeStr: string): string {
  const time = /^\d{2}:\d{2}$/.test(timeStr) ? `${timeStr}:00` : timeStr;
  return new Date(`${dateStr}T${time}${IST_OFFSET}`).toISOString();
}
