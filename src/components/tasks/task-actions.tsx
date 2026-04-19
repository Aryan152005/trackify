"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Task } from "@/lib/types/database";
import { CheckCircle2, XCircle, Play, Loader2, FileText, X } from "lucide-react";
import { addTodayEntryNote } from "@/lib/today/actions";

interface TaskActionsProps {
  task: Task;
}

export function TaskActions({ task }: TaskActionsProps) {
  const router = useRouter();
  // Optimistic status — shown immediately on click, reverted on error
  const [optimisticStatus, setOptimisticStatus] = useState<Task["status"]>(task.status);
  const [pendingStatus, setPendingStatus] = useState<Task["status"] | null>(null);
  const [, startTransition] = useTransition();
  const supabase = createClient();

  // "How it went?" inline prompt — appears once a task is marked done.
  // Typing a note calls addTodayEntryNote, which either updates today's work
  // entry or creates one. Dismiss to skip — never blocks the user.
  const [showNotePrompt, setShowNotePrompt] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const current = pendingStatus ?? optimisticStatus;

  function updateStatus(newStatus: Task["status"]) {
    if (pendingStatus) return; // prevent double-click
    const prev = optimisticStatus;
    setOptimisticStatus(newStatus);
    setPendingStatus(newStatus);

    startTransition(async () => {
      try {
        const updateData: Partial<Task> = { status: newStatus };
        if (newStatus === "done" && prev !== "done") {
          updateData.completed_at = new Date().toISOString();
        } else if (newStatus !== "done") {
          updateData.completed_at = null;
        }
        const { error } = await supabase.from("tasks").update(updateData).eq("id", task.id);
        if (error) throw error;
        toast.success(
          newStatus === "done" ? "Marked as done"
          : newStatus === "in-progress" ? "Task started"
          : "Task reopened"
        );
        // Only surface the entry-note prompt when this is a fresh completion —
        // not when the user is just toggling back and forth.
        if (newStatus === "done" && prev !== "done") setShowNotePrompt(true);
        router.refresh();
      } catch (err) {
        // Revert optimistic update
        setOptimisticStatus(prev);
        toast.error(err instanceof Error ? err.message : "Failed to update task");
      } finally {
        setPendingStatus(null);
      }
    });
  }

  const busy = !!pendingStatus;

  async function handleSaveNote() {
    const text = noteDraft.trim();
    if (!text) {
      setShowNotePrompt(false);
      return;
    }
    setSavingNote(true);
    try {
      await addTodayEntryNote(text, `Work log — done: ${task.title}`);
      toast.success("Added to today's log");
      setNoteDraft("");
      setShowNotePrompt(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add note");
    } finally {
      setSavingNote(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {current !== "done" && (
          <Button className="w-full" onClick={() => updateStatus("done")} disabled={busy}>
            {busy && pendingStatus === "done" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            Mark as Done
          </Button>
        )}
        {current === "pending" && (
          <Button variant="outline" className="w-full" onClick={() => updateStatus("in-progress")} disabled={busy}>
            {busy && pendingStatus === "in-progress" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            Start Task
          </Button>
        )}
        {current === "done" && (
          <Button variant="outline" className="w-full" onClick={() => updateStatus("pending")} disabled={busy}>
            {busy && pendingStatus === "pending" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
            Reopen Task
          </Button>
        )}
        {current === "in-progress" && (
          <Button variant="outline" className="w-full" onClick={() => updateStatus("pending")} disabled={busy}>
            {busy && pendingStatus === "pending" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
            Mark as Pending
          </Button>
        )}

        {/* ── "How it went?" inline prompt ─────────────────────────── */}
        {showNotePrompt && current === "done" && (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                <FileText className="h-3.5 w-3.5" />
                How did it go?
              </div>
              <button
                type="button"
                onClick={() => setShowNotePrompt(false)}
                className="rounded p-0.5 text-emerald-600/60 hover:bg-emerald-100 hover:text-emerald-700 dark:hover:bg-emerald-900/40"
                aria-label="Skip adding a note"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-1 text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
              Add a quick note — it appends to today&apos;s work entry automatically.
            </p>
            <textarea
              rows={2}
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="e.g. Shipped the fix, reviewed 2 PRs, blocked on API doc from X"
              className="mt-2 w-full resize-y rounded-md border border-emerald-200 bg-white px-2 py-1.5 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-emerald-900/40 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <div className="mt-2 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowNotePrompt(false)}
                disabled={savingNote}
              >
                Skip
              </Button>
              <Button size="sm" onClick={handleSaveNote} disabled={savingNote || !noteDraft.trim()}>
                {savingNote ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <FileText className="mr-1 h-3.5 w-3.5" />}
                Add to today&apos;s log
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
