"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Bell, Loader2 } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { createReminderForEntity } from "@/lib/reminders/actions";
import { istDateTimeToUtcISO, utcISOToIstLocalInput, istDateKey } from "@/lib/utils/datetime";

interface Props {
  task: {
    id: string;
    title: string;
    description: string | null;
    due_date: string | null;
    due_time: string | null;
    workspace_id: string | null;
  };
  /** When true, renders as a compact icon trigger (for task rows). */
  compact?: boolean;
}

/**
 * Default reminder time (IST) for a task:
 *   - If the task has both due_date and due_time, use that exact instant.
 *   - If it has only due_date, use 09:00 IST on that date.
 *   - Otherwise, 1 hour from now.
 */
function defaultReminderLocal(task: Props["task"]): string {
  if (task.due_date) {
    const timeStr = task.due_time ?? "09:00";
    return utcISOToIstLocalInput(istDateTimeToUtcISO(task.due_date, timeStr));
  }
  const inOneHour = new Date(Date.now() + 3600 * 1000);
  return utcISOToIstLocalInput(inOneHour.toISOString());
}

export function TaskReminderButton({ task, compact = false }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [timeLocal, setTimeLocal] = useState(() => defaultReminderLocal(task));
  const [noteTitle, setNoteTitle] = useState(`Task: ${task.title}`);
  const [noteBody, setNoteBody] = useState(task.description ?? "");

  function useSameAsDue() {
    setTimeLocal(defaultReminderLocal(task));
  }

  function handleCreate() {
    if (!noteTitle.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!timeLocal) {
      toast.error("Reminder time is required");
      return;
    }
    startTransition(async () => {
      try {
        await createReminderForEntity({
          title: noteTitle,
          description: noteBody,
          reminder_time_local: timeLocal,
          workspace_id: task.workspace_id,
          entity_type: "task",
          entity_id: task.id,
        });
        toast.success("Reminder set · you'll be notified (IST)");
        setOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to create reminder");
      }
    });
  }

  const hasDueDate = !!task.due_date;
  const istDueLabel = hasDueDate
    ? `${task.due_date}${task.due_time ? ` at ${task.due_time}` : " at 9:00 AM"} IST`
    : null;

  return (
    <>
      {compact ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md p-1.5 text-zinc-400 hover:bg-indigo-100 hover:text-indigo-600 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300"
          title="Set reminder for this task"
          aria-label="Set reminder for this task"
        >
          <Bell className="h-3.5 w-3.5" />
        </button>
      ) : (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setOpen(true)}
          type="button"
        >
          <Bell className="mr-2 h-4 w-4" />
          Set Reminder
        </Button>
      )}

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in" />
          <Dialog.Content className="sheet-on-mobile fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-zinc-200 bg-white p-5 shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:zoom-in-95 dark:border-zinc-800 dark:bg-zinc-900">
            <Dialog.Title className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Set reminder for this task
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              All times are IST. You&apos;ll get a push notification + in-app alert.
            </Dialog.Description>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Reminder title
                </label>
                <input
                  type="text"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Note (optional)
                </label>
                <textarea
                  rows={2}
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  className="w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Remind me at (IST)
                  </label>
                  {hasDueDate && (
                    <button
                      type="button"
                      onClick={useSameAsDue}
                      className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      Use due date ({istDueLabel})
                    </button>
                  )}
                </div>
                <input
                  type="datetime-local"
                  value={timeLocal}
                  onChange={(e) => setTimeLocal(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
                {/* Quick chips */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[
                    { label: "+15m", minutes: 15 },
                    { label: "+1h", minutes: 60 },
                    { label: "+3h", minutes: 180 },
                    { label: "Tomorrow 9 AM", minutes: -1 },
                  ].map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => {
                        if (chip.minutes === -1) {
                          // Tomorrow 9 AM IST (date math via IST calendar key)
                          const today = istDateKey(new Date());
                          const tomorrow = new Date(new Date(`${today}T00:00:00+05:30`).getTime() + 24 * 3600 * 1000);
                          const tomorrowKey = istDateKey(tomorrow);
                          setTimeLocal(utcISOToIstLocalInput(istDateTimeToUtcISO(tomorrowKey, "09:00")));
                        } else {
                          setTimeLocal(
                            utcISOToIstLocalInput(
                              new Date(Date.now() + chip.minutes * 60 * 1000).toISOString(),
                            ),
                          );
                        }
                      }}
                      className="rounded-full border border-zinc-300 bg-white px-2.5 py-0.5 text-[11px] font-medium text-zinc-700 transition hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/30 dark:hover:text-indigo-300"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleCreate} disabled={pending || !noteTitle.trim() || !timeLocal}>
                {pending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Bell className="mr-1 h-3.5 w-3.5" />}
                Create reminder
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
