"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, Layout, Rows3, Palette, Plus, Kanban, CalendarDays } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { updateUserPreferences } from "@/lib/preferences/actions";
import { usePreferencesSetter } from "@/lib/preferences/provider";
import {
  ACCENT_COLORS,
  type UserPreferences,
  type AccentColor,
  type LandingPage,
  type ListDensity,
  type DefaultTaskView,
  type DefaultCalendarView,
} from "@/lib/preferences/types";

/**
 * Preferences form — a vertical stack of sections, each of which is a
 * self-contained segmented control or swatch picker that saves the moment
 * you click. No "Save" button: every choice is immediately persistent +
 * optimistically applied via the PreferencesProvider so the change is
 * visible without a refresh.
 */
export function PreferencesForm({ initial }: { initial: UserPreferences }) {
  const router = useRouter();
  const setLocal = usePreferencesSetter();
  const [prefs, setPrefs] = useState<UserPreferences>(initial);
  const [pending, startTransition] = useTransition();
  const [savingKey, setSavingKey] = useState<keyof UserPreferences | null>(null);

  function save<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) {
    // Optimistic local + provider update so the UI (accent, density, FAB)
    // reacts instantly. Server reconciles in the background; on failure we
    // roll back.
    const prev = prefs[key];
    setPrefs((p) => ({ ...p, [key]: value }));
    setLocal({ [key]: value });
    setSavingKey(key);
    startTransition(async () => {
      try {
        await updateUserPreferences({ [key]: value } as Partial<UserPreferences>);
        // router.refresh so server components that read prefs (e.g. whether
        // to render the FAB in the (main) layout) pick up the change.
        router.refresh();
      } catch (err) {
        // Roll back optimistic state.
        setPrefs((p) => ({ ...p, [key]: prev }));
        setLocal({ [key]: prev });
        toast.error(err instanceof Error ? err.message : "Couldn't save preference");
      } finally {
        setSavingKey(null);
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* ── Landing page ──────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Layout className="h-4 w-4 text-indigo-500" />
            Where should Trackify start you each day?
            {savingKey === "landingPage" && pending && <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin text-zinc-400" />}
          </CardTitle>
          <CardDescription className="text-xs">
            Applies after you sign in or click the Trackify logo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Segmented
            value={prefs.landingPage}
            onChange={(v) => save("landingPage", v)}
            options={[
              { value: "dashboard", label: "Dashboard", hint: "Analytics & widgets" },
              { value: "today", label: "Today", hint: "Focus mode" },
              { value: "tasks", label: "Tasks", hint: "List view" },
              { value: "notes", label: "Notes", hint: "Docs first" },
            ] as const satisfies ReadonlyArray<{ value: LandingPage; label: string; hint: string }>}
          />
        </CardContent>
      </Card>

      {/* ── List density ──────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Rows3 className="h-4 w-4 text-indigo-500" />
            List density
            {savingKey === "listDensity" && pending && <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin text-zinc-400" />}
          </CardTitle>
          <CardDescription className="text-xs">
            Compact fits more items on screen. Comfortable is easier to scan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Segmented
            value={prefs.listDensity}
            onChange={(v) => save("listDensity", v)}
            options={[
              { value: "comfortable", label: "Comfortable", hint: "Default" },
              { value: "compact", label: "Compact", hint: "Dense rows" },
            ] as const satisfies ReadonlyArray<{ value: ListDensity; label: string; hint: string }>}
          />
        </CardContent>
      </Card>

      {/* ── Accent color ─────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="h-4 w-4 text-indigo-500" />
            Accent color
            {savingKey === "accentColor" && pending && <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin text-zinc-400" />}
          </CardTitle>
          <CardDescription className="text-xs">
            Used for callouts and buttons. Dark/light theme still controlled separately.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(ACCENT_COLORS) as AccentColor[]).map((c) => {
              const { name, hex } = ACCENT_COLORS[c];
              const active = prefs.accentColor === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => save("accentColor", c)}
                  title={name}
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition ${
                    active
                      ? "border-zinc-900 dark:border-zinc-100"
                      : "border-transparent hover:scale-110"
                  }`}
                  style={{ backgroundColor: hex }}
                  aria-pressed={active}
                  aria-label={name}
                >
                  {active && <Check className="h-4 w-4 text-white" strokeWidth={3} />}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Default tasks view ───────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Kanban className="h-4 w-4 text-indigo-500" />
            Default tasks view
            {savingKey === "defaultTaskView" && pending && <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin text-zinc-400" />}
          </CardTitle>
          <CardDescription className="text-xs">
            Where the Tasks nav link points. You can still open boards directly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Segmented
            value={prefs.defaultTaskView}
            onChange={(v) => save("defaultTaskView", v)}
            options={[
              { value: "list", label: "List", hint: "Grouped by due date" },
              { value: "board", label: "Kanban", hint: "Board view" },
            ] as const satisfies ReadonlyArray<{ value: DefaultTaskView; label: string; hint: string }>}
          />
        </CardContent>
      </Card>

      {/* ── Default calendar view ────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-4 w-4 text-indigo-500" />
            Default calendar view
            {savingKey === "defaultCalendarView" && pending && <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin text-zinc-400" />}
          </CardTitle>
          <CardDescription className="text-xs">
            What the Calendar page opens to.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Segmented
            value={prefs.defaultCalendarView}
            onChange={(v) => save("defaultCalendarView", v)}
            options={[
              { value: "month", label: "Month", hint: "Big picture" },
              { value: "week", label: "Week", hint: "Hour-by-hour" },
            ] as const satisfies ReadonlyArray<{ value: DefaultCalendarView; label: string; hint: string }>}
          />
        </CardContent>
      </Card>

      {/* ── Floating + button ────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4 text-indigo-500" />
            Quick-capture button
            {savingKey === "fabVisible" && pending && <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin text-zinc-400" />}
          </CardTitle>
          <CardDescription className="text-xs">
            The floating + on every page. Press <kbd className="rounded bg-zinc-100 px-1 text-[10px] dark:bg-zinc-800">C</kbd> to open it from the keyboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Segmented
            value={prefs.fabVisible ? "show" : "hide"}
            onChange={(v) => save("fabVisible", v === "show")}
            options={[
              { value: "show", label: "Show", hint: "Always visible" },
              { value: "hide", label: "Hide", hint: "Keyboard-only (press C)" },
            ] as const}
          />
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Generic segmented control — hint text lives below the active option.
// ─────────────────────────────────────────────────────────────

interface SegOpt<T extends string> {
  value: T;
  label: string;
  hint?: string;
}
function Segmented<T extends string>({
  value, onChange, options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: ReadonlyArray<SegOpt<T>>;
}) {
  const active = options.find((o) => o.value === value);
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const isActive = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                isActive
                  ? "border-indigo-400 bg-indigo-50 text-indigo-700 shadow-sm dark:border-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300"
                  : "border-zinc-300 bg-white text-zinc-600 hover:border-indigo-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {active?.hint && (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{active.hint}</p>
      )}
    </div>
  );
}
