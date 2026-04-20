"use client";

import { useEffect, useState, useTransition } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Sparkles,
  X,
  Check,
  AlertTriangle,
  Loader2,
  CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  shouldShowWeeklyPrompt,
  getWeeklyReviewSnapshot,
  saveWeeklyReview,
  type WeeklyReviewSnapshot,
} from "@/lib/reviews/actions";

const SKIP_STORAGE_KEY = "trackify:weekly-review-skipped-at";
const SKIP_COOLDOWN_HOURS = 20; // skip for the rest of the day

/**
 * Friday-5pm-IST weekly review prompt. Auto-opens the FIRST time a
 * user lands on /today during the review window (Fri ≥17:00, Sat, Sun)
 * unless they've already reviewed this week OR dismissed the prompt
 * in the last 20 hours (localStorage flag — purposely NOT a DB write,
 * because we don't want to force a "I'll never do it" state).
 *
 * The ritual: read what shipped + what slipped (auto-computed), write
 * one reflection line, optionally name a next-week intention. Takes
 * ~2 minutes on average. Sunsama-style.
 */
export function WeeklyReviewModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<WeeklyReviewSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [reflection, setReflection] = useState("");
  const [nextIntent, setNextIntent] = useState("");
  const [saving, startSave] = useTransition();

  // Decide whether to auto-open on mount. Cheap local check first to
  // avoid a DB round-trip every Today-page render.
  useEffect(() => {
    let cancelled = false;
    async function check() {
      const skippedAt = typeof window !== "undefined"
        ? window.localStorage.getItem(SKIP_STORAGE_KEY)
        : null;
      if (skippedAt) {
        const diffH = (Date.now() - Number(skippedAt)) / (1000 * 60 * 60);
        if (diffH < SKIP_COOLDOWN_HOURS) return;
      }
      try {
        const { show } = await shouldShowWeeklyPrompt();
        if (cancelled) return;
        if (show) {
          setOpen(true);
          void loadSnapshot();
        }
      } catch {
        /* silent — don't surface plumbing errors to the user */
      }
    }
    void check();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadSnapshot() {
    setLoading(true);
    try {
      const snap = await getWeeklyReviewSnapshot();
      setSnapshot(snap);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't load this week's data");
    } finally {
      setLoading(false);
    }
  }

  function skip() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SKIP_STORAGE_KEY, String(Date.now()));
    }
    setOpen(false);
  }

  function save() {
    if (!reflection.trim()) {
      toast.error("Write at least one line of reflection.");
      return;
    }
    startSave(async () => {
      try {
        await saveWeeklyReview({
          reflection,
          nextWeekIntent: nextIntent || null,
          shippedCount: snapshot?.shipped.length ?? 0,
          slippedCount: snapshot?.slipped.length ?? 0,
        });
        toast.success("Review saved. Have a good weekend.");
        setOpen(false);
        setReflection("");
        setNextIntent("");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="sheet-on-mobile fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-full max-w-xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
            <div className="min-w-0">
              <Dialog.Title className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-50">
                <Sparkles className="h-4 w-4 text-indigo-500" />
                Weekly review
              </Dialog.Title>
              <Dialog.Description className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                Three minutes — look back at your week, land one line of reflection, then close the laptop.
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

          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
              </div>
            ) : snapshot ? (
              <>
                <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Week of {formatDate(snapshot.weekStart)} — {formatDate(snapshot.weekEnd)}
                </div>

                {/* What shipped */}
                <section>
                  <h3 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                    <Check className="h-3 w-3" />
                    Shipped · {snapshot.shipped.length}
                  </h3>
                  {snapshot.shipped.length === 0 ? (
                    <p className="rounded-md border border-dashed border-zinc-200 px-3 py-2 text-xs italic text-zinc-400 dark:border-zinc-700 dark:text-zinc-500">
                      Nothing closed this week. That's data, not a judgement.
                    </p>
                  ) : (
                    <ul className="space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
                      {snapshot.shipped.map((t) => (
                        <li key={t.id} className="flex items-start gap-1.5">
                          <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
                          <span className="truncate">{t.title}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {/* What slipped */}
                <section>
                  <h3 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-3 w-3" />
                    Slipped · {snapshot.slipped.length}
                  </h3>
                  {snapshot.slipped.length === 0 ? (
                    <p className="rounded-md border border-dashed border-zinc-200 px-3 py-2 text-xs italic text-zinc-400 dark:border-zinc-700 dark:text-zinc-500">
                      Clean week. You either planned well or you planned light.
                    </p>
                  ) : (
                    <ul className="space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
                      {snapshot.slipped.map((t) => (
                        <li key={`${t.kind}:${t.id}`} className="flex items-start gap-1.5">
                          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                          <span className="truncate">{t.title}</span>
                          <span className="shrink-0 rounded bg-zinc-100 px-1 text-[9px] uppercase text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                            {t.kind}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            ) : null}

            {/* Reflection — the only thing we actually store. */}
            <section>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                One-line reflection <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                placeholder="What's one thing you noticed? — e.g. 'mornings before standup were where real work got done'"
                rows={3}
                maxLength={2000}
                className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </section>

            {/* Optional next-week intent */}
            <section>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                One thing to change next week (optional)
              </label>
              <input
                type="text"
                value={nextIntent}
                onChange={(e) => setNextIntent(e.target.value)}
                placeholder="e.g. no meetings before noon on Monday"
                maxLength={500}
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </section>
          </div>

          {/* Footer */}
          <div className="flex flex-col-reverse items-stretch gap-2 border-t border-zinc-200 bg-zinc-50/60 px-5 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-900/60">
            <Button variant="outline" onClick={skip} className="shrink-0">
              Skip this week
            </Button>
            <Button onClick={save} disabled={saving || !reflection.trim()} className="gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              {saving ? "Saving…" : "Save review"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function formatDate(ymd: string): string {
  const d = new Date(ymd + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
