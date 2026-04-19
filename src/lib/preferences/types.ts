/**
 * Per-user UI/UX preferences.
 *
 * Default values live here (single source of truth). Any partial row in the
 * database is merged over these so adding a new key is non-breaking.
 *
 * Design rules:
 *   - Every field is optional in the DB but always defined at runtime.
 *   - The set of legal values is typed as a string literal union so the
 *     Preferences UI can render a segmented control from it cleanly.
 */

export type LandingPage = "dashboard" | "today" | "tasks" | "notes";
export type ListDensity = "compact" | "comfortable";
export type AccentColor =
  | "indigo"
  | "blue"
  | "emerald"
  | "amber"
  | "rose"
  | "purple";
export type DefaultTaskView = "list" | "board";
export type DefaultCalendarView = "month" | "week";

export interface UserPreferences {
  landingPage: LandingPage;
  listDensity: ListDensity;
  accentColor: AccentColor;
  fabVisible: boolean;
  defaultTaskView: DefaultTaskView;
  defaultCalendarView: DefaultCalendarView;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  landingPage: "dashboard",
  listDensity: "comfortable",
  accentColor: "indigo",
  fabVisible: true,
  defaultTaskView: "list",
  defaultCalendarView: "month",
};

/**
 * CSS color values for each accent option. Applied as a `--accent` custom
 * property on <html>; components that want to honour the accent use
 * `var(--accent)` or the tailwind `text-[var(--accent)]` pattern.
 */
export const ACCENT_COLORS: Record<AccentColor, { name: string; hex: string }> = {
  indigo:  { name: "Indigo (default)", hex: "#6366f1" },
  blue:    { name: "Blue",             hex: "#3b82f6" },
  emerald: { name: "Emerald",          hex: "#10b981" },
  amber:   { name: "Amber",            hex: "#f59e0b" },
  rose:    { name: "Rose",             hex: "#f43f5e" },
  purple:  { name: "Purple",           hex: "#a855f7" },
};

export function normalizePreferences(
  raw: Partial<UserPreferences> | null | undefined,
): UserPreferences {
  return { ...DEFAULT_PREFERENCES, ...(raw ?? {}) };
}

export function pathForLanding(page: LandingPage): string {
  switch (page) {
    case "today": return "/today";
    case "tasks": return "/tasks";
    case "notes": return "/notes";
    case "dashboard":
    default:      return "/dashboard";
  }
}
