/**
 * Shared natural-language parser used by both the server quickCapture
 * action and the client FAB's live preview.
 *
 * Kept intentionally tiny — no NLP dep, just pattern matching over:
 *   - time expressions (6pm, 18:00, 6:30, 9am)
 *   - date keywords (today, tonight, tomorrow, weekdays)
 *   - intent keywords (remind me, meeting, meet, call)
 *
 * Returns a descriptor the client can preview without hitting the server,
 * and the server can use to commit the right kind of record.
 */

import { istDateKey } from "@/lib/utils/datetime";

export type ParsedKind = "task" | "reminder" | "event";

export interface ParseResult {
  /** Which entity we would create if the user commits this line. */
  kind: ParsedKind;
  /** Cleaned title (time + keywords stripped) or original text if nothing to strip. */
  title: string;
  /** IST date key (YYYY-MM-DD) when one was detected, else null. */
  dateKey: string | null;
  /** Local time HH:mm in IST when detected, else null. */
  time: string | null;
  /** Short human rationale — shown in the preview so the user understands why. */
  reasoning: string;
}

const WEEKDAYS = [
  "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
] as const;

const EVENT_HINTS = /\b(meeting|meet|sync|call\s+with|lunch\s+with|standup|interview|1-1|1:1|review\s+with)\b/i;

/**
 * Returns the IST day-of-week (0=Sun..6=Sat) regardless of the browser/runtime
 * timezone. We build a date string in the IST locale and re-parse it.
 */
function istDayOfWeek(): number {
  const istDate = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
  );
  return istDate.getDay();
}

export function parseCapture(rawText: string): ParseResult {
  const text = rawText.trim();
  if (!text) {
    return {
      kind: "task",
      title: "",
      dateKey: null,
      time: null,
      reasoning: "Type something to capture.",
    };
  }

  const lower = text.toLowerCase();

  // ── Detect time ─────────────────────────────────────────────
  const timeRe = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;
  const timeMatch = lower.match(timeRe);
  let hh: number | null = null;
  let mm: number | null = null;
  if (timeMatch) {
    const rawHour = parseInt(timeMatch[1], 10);
    const rawMin = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const meridiem = timeMatch[3]?.toLowerCase();
    // Must actually look like a time, not just a bare number in the title
    // ("finish task 5") — require either a meridiem OR colon OR "at/by".
    const hasMeridiem = !!meridiem;
    const hasColon = !!timeMatch[2];
    const timeContextRe = /\b(at|by|around|until|till|from)\b/i;
    const hasTimeContext = timeContextRe.test(lower);
    const hasRemindMe = /\bremind\s+me\b/i.test(lower);
    const strong = hasMeridiem || hasColon || hasTimeContext || hasRemindMe;
    if (strong && rawHour >= 0 && rawHour <= 23 && rawMin < 60) {
      let hours = rawHour;
      if (meridiem === "pm" && hours < 12) hours += 12;
      if (meridiem === "am" && hours === 12) hours = 0;
      if (hours <= 23) {
        hh = hours;
        mm = rawMin;
      }
    }
  }

  // ── Detect date ─────────────────────────────────────────────
  const now = new Date();
  const todayKey = istDateKey(now);
  const tomorrowKey = istDateKey(new Date(now.getTime() + 24 * 3600 * 1000));
  let dateKey: string | null = null;
  let dateReason = "";

  if (/\btomorrow\b/.test(lower)) {
    dateKey = tomorrowKey;
    dateReason = "tomorrow";
  } else if (/\btonight\b/.test(lower)) {
    dateKey = todayKey;
    dateReason = "tonight";
  } else if (/\btoday\b/.test(lower)) {
    dateKey = todayKey;
    dateReason = "today";
  } else {
    const dow = istDayOfWeek();
    for (let i = 0; i < 7; i++) {
      const wd = WEEKDAYS[i];
      if (new RegExp(`\\b${wd}\\b`).test(lower)) {
        const daysAhead = ((i - dow + 7) % 7) || 7;
        const target = new Date(now.getTime() + daysAhead * 24 * 3600 * 1000);
        dateKey = istDateKey(target);
        dateReason = `next ${wd[0].toUpperCase()}${wd.slice(1)}`;
        break;
      }
    }
  }

  // ── Decide kind ─────────────────────────────────────────────
  const hasRemindMe = /\bremind\s+me\b/i.test(lower);
  const looksLikeEvent = EVENT_HINTS.test(lower) && (hh != null || dateKey);
  const hasTimeSignal = hh != null;

  let kind: ParsedKind = "task";
  let whyKind = "Default — no time or date detected, saving as a task.";

  if (hasRemindMe) {
    kind = "reminder";
    whyKind = "\"remind me\" → scheduled reminder.";
  } else if (looksLikeEvent) {
    kind = "event";
    whyKind = "Meeting / call keyword + time → calendar event.";
  } else if (hasTimeSignal || dateKey) {
    kind = "reminder";
    whyKind = "Time or date detected → scheduled reminder.";
  }

  // If we picked reminder/event but no time was given, default to 9 AM IST.
  let timeStr: string | null = null;
  if (hh != null) {
    timeStr = `${String(hh).padStart(2, "0")}:${String(mm ?? 0).padStart(2, "0")}`;
  } else if (kind !== "task") {
    timeStr = "09:00";
  }
  if (!dateKey && kind !== "task") {
    dateKey = todayKey;
    if (!dateReason) dateReason = "today (default)";
  }

  // ── Clean title ─────────────────────────────────────────────
  let title = text
    .replace(/\bremind\s+me\b/gi, "")
    .replace(/\b(to|at|on|by|around|until|till|from)\b/gi, " ")
    .replace(timeRe, " ")
    .replace(
      /\b(today|tonight|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
  if (!title) title = text;

  // ── Reasoning shown in preview ──────────────────────────────
  const parts: string[] = [whyKind];
  if (dateReason) parts.push(`Date: ${dateReason}`);
  if (timeStr) parts.push(`Time: ${formatTime12(timeStr)} IST`);
  const reasoning = parts.join(" · ");

  return { kind, title, dateKey, time: timeStr, reasoning };
}

function formatTime12(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const meridiem = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${meridiem}`;
}
