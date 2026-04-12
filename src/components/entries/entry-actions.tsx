"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2, Loader2, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateEntry, deleteEntry } from "@/lib/entries/actions";

interface EntryActionsProps {
  entryId: string;
  initialTitle: string;
  initialDate: string;
  initialStatus: string;
  initialDescription: string;
  initialWorkDone: string;
  initialLearning: string;
  initialNextDayPlan: string;
  initialMood: string;
  initialScore: number | null;
  initialHours: number | null;
}

export function EntryActions(props: EntryActionsProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  // Form fields
  const [title, setTitle] = useState(props.initialTitle);
  const [date, setDate] = useState(props.initialDate);
  const [status, setStatus] = useState(props.initialStatus);
  const [description, setDescription] = useState(props.initialDescription);
  const [workDone, setWorkDone] = useState(props.initialWorkDone);
  const [learning, setLearning] = useState(props.initialLearning);
  const [nextDayPlan, setNextDayPlan] = useState(props.initialNextDayPlan);
  const [mood, setMood] = useState(props.initialMood);
  const [score, setScore] = useState<number | null>(props.initialScore);
  const [hours, setHours] = useState<number | null>(props.initialHours);

  async function handleSave() {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    setBusy(true);
    try {
      await updateEntry(props.entryId, {
        title: title.trim(),
        date,
        status,
        description: description.trim() || null,
        work_done: workDone.trim() || null,
        learning: learning.trim() || null,
        next_day_plan: nextDayPlan.trim() || null,
        mood: mood.trim() || null,
        productivity_score: score,
        hours_worked: hours,
      });
      toast.success("Entry updated");
      setEditing(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${props.initialTitle}"? This can't be undone.`)) return;
    setBusy(true);
    try {
      await deleteEntry(props.entryId);
      toast.success("Entry deleted");
      router.push("/entries");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete");
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-1.5">
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDelete}
          disabled={busy}
          className="gap-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-16 sm:pt-24">
      <div className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Edit entry</h2>
          <button onClick={() => setEditing(false)} className="rounded p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <Field label="Title">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </Field>
            <Field label="Status">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              >
                <option value="done">Done</option>
                <option value="in-progress">In progress</option>
                <option value="blocked">Blocked</option>
              </select>
            </Field>
          </div>
          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </Field>
          <Field label="Work done">
            <textarea
              value={workDone}
              onChange={(e) => setWorkDone(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </Field>
          <Field label="Learning">
            <textarea
              value={learning}
              onChange={(e) => setLearning(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </Field>
          <Field label="Next day plan">
            <textarea
              value={nextDayPlan}
              onChange={(e) => setNextDayPlan(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Mood">
              <input
                value={mood}
                onChange={(e) => setMood(e.target.value)}
                placeholder="e.g. energized"
                className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </Field>
            <Field label="Hours">
              <input
                type="number"
                min={0}
                max={24}
                step="0.25"
                value={hours ?? ""}
                onChange={(e) => setHours(e.target.value === "" ? null : Number(e.target.value))}
                placeholder="e.g. 6.5"
                className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </Field>
            <Field label="Score (1–10)">
              <input
                type="number"
                min={1}
                max={10}
                value={score ?? ""}
                onChange={(e) => setScore(e.target.value === "" ? null : Number(e.target.value))}
                className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </Field>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing(false)} disabled={busy}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={busy} className="gap-1.5">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
        {label}
      </label>
      {children}
    </div>
  );
}
