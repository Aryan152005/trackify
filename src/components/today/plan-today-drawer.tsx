"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { toast } from "sonner";
import {
  Sparkles,
  X,
  Check,
  AlertTriangle,
  Calendar as CalendarIcon,
  ArrowUpRight,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  listPlanCandidates,
  saveTodayPlan,
  type DailyPlanCandidate,
} from "@/lib/today/plan-actions";

const MAX_PICK_SOFT = 5;
const MAX_PICK_HARD = 10;

interface Props {
  /** Whether the drawer is open (controlled by parent). */
  open: boolean;
  onOpenChange: (next: boolean) => void;
  /** Initial pick set (for "replan" where the user already has a plan). */
  initialTaskIds?: string[];
  initialIntention?: string | null;
  /** Called after a successful save so the parent can refresh. */
  onSaved?: () => void;
}

/**
 * Plan today — the morning ritual. User sees three buckets (overdue,
 * today, upcoming) and toggles 3-5 items onto their Today plan. Also
 * optionally writes a one-line intention ("focus: ship onboarding").
 *
 * Soft cap at 5 (warning, not blocker); hard cap at 10 (can't pick more).
 * Things 3 calls this the "commitment". We frame it softer — the goal is
 * intentionality, not rigid limits.
 */
export function PlanTodayDrawer({
  open,
  onOpenChange,
  initialTaskIds,
  initialIntention,
  onSaved,
}: Props) {
  const [candidates, setCandidates] = useState<DailyPlanCandidate[]>([]);
  const [picked, setPicked] = useState<string[]>(initialTaskIds ?? []);
  const [intention, setIntention] = useState<string>(initialIntention ?? "");
  const [loading, setLoading] = useState(true);
  const [saving, startSaving] = useTransition();

  // Refresh candidates whenever the drawer opens. Fresh list every time
  // — a task completed in the last 5 minutes shouldn't reappear here.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const c = await listPlanCandidates();
      setCandidates(c);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't load tasks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  // Sync initial picks if parent changed them while the drawer is open.
  useEffect(() => {
    if (open && initialTaskIds) setPicked(initialTaskIds);
  }, [open, initialTaskIds]);

  function toggle(id: string) {
    setPicked((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_PICK_HARD) {
        toast.warning(`Soft-capped at ${MAX_PICK_HARD} — unpick something first.`);
        return prev;
      }
      return [...prev, id];
    });
  }

  function save() {
    startSaving(async () => {
      try {
        await saveTodayPlan({ taskIds: picked, intention: intention || null });
        toast.success(
          picked.length === 0
            ? "Plan cleared — you can still capture ad-hoc."
            : `Locked in ${picked.length} for today. Go.`,
        );
        onSaved?.();
        onOpenChange(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  const buckets = {
    overdue: candidates.filter((c) => c.bucket === "overdue"),
    today: candidates.filter((c) => c.bucket === "today"),
    upcoming: candidates.filter((c) => c.bucket === "upcoming"),
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="sheet-on-mobile fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-full max-w-xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
            <div className="min-w-0">
              <Dialog.Title className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-50">
                <Sparkles className="h-4 w-4 text-indigo-500" />
                Plan today
              </Dialog.Title>
              <Dialog.Description className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                Pick 3–5 things you'll actually do. Everything else can wait.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {/* Intention */}
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Today's intention (optional)
              </label>
              <input
                type="text"
                value={intention}
                onChange={(e) => setIntention(e.target.value)}
                placeholder="e.g. ship the onboarding email"
                maxLength={500}
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
              </div>
            ) : candidates.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-300 py-10 text-center dark:border-zinc-700">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  No open tasks. Capture one from /today and come back.
                </p>
              </div>
            ) : (
              <>
                <Bucket
                  label="Overdue"
                  icon={<AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
                  items={buckets.overdue}
                  picked={picked}
                  onToggle={toggle}
                  tone="red"
                />
                <Bucket
                  label="Due today"
                  icon={<CalendarIcon className="h-3.5 w-3.5 text-indigo-500" />}
                  items={buckets.today}
                  picked={picked}
                  onToggle={toggle}
                  tone="indigo"
                />
                <Bucket
                  label="Coming up"
                  icon={<ArrowUpRight className="h-3.5 w-3.5 text-zinc-400" />}
                  items={buckets.upcoming}
                  picked={picked}
                  onToggle={toggle}
                  tone="zinc"
                />
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 border-t border-zinc-200 bg-zinc-50/60 px-5 py-3 dark:border-zinc-800 dark:bg-zinc-900/60">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              <span
                className={cn(
                  "font-semibold",
                  picked.length === 0 && "text-zinc-400",
                  picked.length > 0 && picked.length <= MAX_PICK_SOFT && "text-emerald-600 dark:text-emerald-400",
                  picked.length > MAX_PICK_SOFT && "text-amber-600 dark:text-amber-400",
                )}
              >
                {picked.length}
              </span>
              {" picked"}
              {picked.length > MAX_PICK_SOFT && (
                <span className="ml-1 text-amber-500">· ambitious — can you really do {picked.length}?</span>
              )}
            </div>
            <Button onClick={save} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              {saving ? "Saving…" : "Lock it in"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ────────────────────────────────────────────────────────────────────

function Bucket({
  label,
  icon,
  items,
  picked,
  onToggle,
  tone,
}: {
  label: string;
  icon: React.ReactNode;
  items: DailyPlanCandidate[];
  picked: string[];
  onToggle: (id: string) => void;
  tone: "red" | "indigo" | "zinc";
}) {
  if (items.length === 0) return null;

  const toneClass: Record<typeof tone, string> = {
    red: "border-red-100 dark:border-red-900/30",
    indigo: "border-indigo-100 dark:border-indigo-900/30",
    zinc: "border-zinc-100 dark:border-zinc-800",
  };

  return (
    <div>
      <h3 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {icon}
        {label}
        <span className="text-zinc-300 dark:text-zinc-600">· {items.length}</span>
      </h3>
      <ul className={cn("divide-y rounded-lg border", toneClass[tone], "divide-zinc-100 dark:divide-zinc-800")}>
        {items.map((t) => {
          const isPicked = picked.includes(t.id);
          return (
            <li key={t.id}>
              <label
                className={cn(
                  "flex cursor-pointer items-start gap-2.5 px-3 py-2 text-sm transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50",
                  isPicked && "bg-indigo-50/60 dark:bg-indigo-950/20",
                )}
              >
                <input
                  type="checkbox"
                  checked={isPicked}
                  onChange={() => onToggle(t.id)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-indigo-600"
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "truncate",
                      isPicked
                        ? "font-medium text-zinc-900 dark:text-zinc-50"
                        : "text-zinc-700 dark:text-zinc-300",
                    )}
                  >
                    {t.title}
                  </p>
                  {(t.due_date || t.priority !== "medium") && (
                    <p className="mt-0.5 flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                      {t.due_date && (
                        <span>
                          Due {new Date(t.due_date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          {t.due_time ? ` · ${t.due_time}` : ""}
                        </span>
                      )}
                      {t.priority !== "medium" && (
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-0 text-[9px] font-semibold uppercase",
                            (t.priority === "urgent" || t.priority === "high") &&
                              "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
                            t.priority === "low" && "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
                          )}
                        >
                          {t.priority}
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
