"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Clock, CalendarPlus, Check, Loader2, X, Pencil } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { updateTask, scheduleTaskOnCalendar } from "@/lib/tasks/actions";
import { utcISOToIstLocalInput, istLocalToUtcISO, formatIST } from "@/lib/utils/datetime";
import type { Task } from "@/lib/types/database";

interface Props {
  task: Task;
}

/**
 * "How long?" + "Schedule it" — Motion-inspired time-boxing without the
 * auto-scheduler anxiety. Two actions in one card:
 *   1. Edit the task's estimate_minutes inline (stored on the task row).
 *   2. Once an estimate exists, offer a one-click schedule that creates
 *      a calendar event at a user-picked start time (defaults to the
 *      next half-hour). Duration = estimate.
 *
 * Never schedules without explicit user click. Never rewrites existing
 * calendar events. If the user wants to re-schedule, they delete the
 * event from /calendar or schedule again (which creates a second one).
 */
export function TaskEstimateCard({ task }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(
    task.estimate_minutes ? String(task.estimate_minutes) : "",
  );
  const [savingEstimate, startSaveEstimate] = useTransition();

  const [scheduling, setScheduling] = useState(false);
  // Default schedule time — today at the next half-hour in IST, as a
  // datetime-local value (the DOM control expects "YYYY-MM-DDTHH:mm").
  const [scheduleStart, setScheduleStart] = useState<string>(() => defaultStart());
  const [sched, startSched] = useTransition();

  function saveEstimate() {
    const value = draft.trim();
    const minutes = value === "" ? null : Number(value);
    if (value !== "" && (!Number.isFinite(minutes) || (minutes as number) <= 0)) {
      toast.error("Enter a positive number of minutes, or blank to clear.");
      return;
    }
    startSaveEstimate(async () => {
      try {
        await updateTask(task.id, { estimate_minutes: minutes as number | null });
        toast.success(
          minutes ? `Estimate set — ${minutes} min` : "Estimate cleared",
        );
        setEditing(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't save estimate");
      }
    });
  }

  function doSchedule() {
    if (!scheduleStart) return;
    let iso: string;
    try {
      iso = istLocalToUtcISO(scheduleStart);
    } catch {
      toast.error("Pick a start time first.");
      return;
    }
    startSched(async () => {
      try {
        const res = await scheduleTaskOnCalendar(task.id, iso);
        toast.success(`Blocked ${task.estimate_minutes ?? 30} min on your calendar.`, {
          description: "Tap to view the event.",
        });
        setScheduling(false);
        // Soft nav to the calendar; using href so the /calendar page reloads
        // fresh with the new event visible.
        if (typeof window !== "undefined") {
          window.location.href = `/calendar?event=${res.event_id}`;
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't schedule");
      }
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4 text-indigo-500" />
          Time-box
        </CardTitle>
        <CardDescription className="text-xs">
          How long will this take? Optional. Once set, block it on your calendar in one click.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Estimate row */}
        {!editing ? (
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm">
              {task.estimate_minutes ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                  <Clock className="h-3 w-3" />
                  {task.estimate_minutes} min
                </span>
              ) : (
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  No estimate yet.
                </span>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
              className="gap-1"
            >
              <Pencil className="h-3 w-3" />
              {task.estimate_minutes ? "Edit" : "Set"}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="number"
              min={1}
              step={5}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="e.g. 45"
              className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:w-32 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
            <div className="flex items-center gap-1">
              <Button size="sm" onClick={saveEstimate} disabled={savingEstimate} className="gap-1">
                {savingEstimate ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Save
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditing(false);
                  setDraft(task.estimate_minutes ? String(task.estimate_minutes) : "");
                }}
                disabled={savingEstimate}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Schedule row — only when an estimate exists */}
        {task.estimate_minutes && !scheduling && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setScheduling(true)}
            className="w-full gap-1.5"
          >
            <CalendarPlus className="h-3.5 w-3.5" />
            Schedule it on calendar
          </Button>
        )}

        {task.estimate_minutes && scheduling && (
          <div className="space-y-2 rounded-lg border border-indigo-200 bg-indigo-50/40 p-3 dark:border-indigo-900/40 dark:bg-indigo-950/20">
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Block {task.estimate_minutes} min starting at:
            </p>
            <input
              type="datetime-local"
              value={scheduleStart}
              onChange={(e) => setScheduleStart(e.target.value)}
              className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {scheduleStart && (
                <>
                  Ends around{" "}
                  {formatIST(
                    new Date(
                      new Date(istLocalToUtcISO(scheduleStart)).getTime()
                        + (task.estimate_minutes ?? 30) * 60 * 1000,
                    ),
                    { hour: "numeric", minute: "2-digit" },
                  )}{" "}
                  IST
                </>
              )}
            </p>
            <div className="flex items-center justify-end gap-1">
              <Button variant="outline" size="sm" onClick={() => setScheduling(false)} disabled={sched}>
                Cancel
              </Button>
              <Button size="sm" onClick={doSchedule} disabled={sched || !scheduleStart} className="gap-1">
                {sched ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarPlus className="h-3.5 w-3.5" />}
                Block time
              </Button>
            </div>
          </div>
        )}

        {task.estimate_minutes && !scheduling && (
          <p className="text-center text-[11px] text-zinc-400 dark:text-zinc-500">
            Or open{" "}
            <Link href="/calendar" className="underline hover:text-indigo-500">
              /calendar
            </Link>{" "}
            to pick manually.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── helpers ───────────────────────────────────────────────────────

/**
 * "Next half-hour" as a datetime-local string in IST. E.g. if it's 14:07
 * IST now, returns today at 14:30; if 14:38, returns 15:00.
 */
function defaultStart(): string {
  const nowIstIso = new Date().toISOString();
  const local = utcISOToIstLocalInput(nowIstIso);
  // local is "YYYY-MM-DDTHH:mm". Round minute to next 30.
  const [d, t] = local.split("T");
  const [hh, mm] = t.split(":").map((x) => Number(x));
  let newH = hh;
  let newM = mm < 30 ? 30 : 0;
  if (newM === 0) newH = (hh + 1) % 24;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d}T${pad(newH)}:${pad(newM)}`;
}
