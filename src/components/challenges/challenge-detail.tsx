"use client";

import { useState, useCallback, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO, addDays } from "date-fns";
import { toast } from "sonner";
import {
  Check, Plus, Pencil, Trash2, Copy, CornerDownRight, CheckCircle2,
  Target, Flame, Calendar as CalIcon, Columns3, Map, Loader2, X,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import * as Popover from "@radix-ui/react-popover";
import {
  updateDay, archiveChallenge, deleteChallenge, renameChallenge,
  currentDayIndex, computeStats,
  type Challenge, type ChallengeDay, type HabitDay, type KanbanDay, type RoadmapDay, type ChallengeTask,
} from "@/lib/challenges/actions";

// ─── Helpers ─────────────────────────────────────────────────────
function randId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function dayLabel(startISO: string, index: number): string {
  const d = addDays(parseISO(startISO), index);
  return format(d, "EEE, MMM d");
}

// ─── Main component ──────────────────────────────────────────────
interface Props { initialChallenge: Challenge }

export function ChallengeDetail({ initialChallenge }: Props) {
  const router = useRouter();
  const [challenge, setChallenge] = useState<Challenge>(initialChallenge);
  const [, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(challenge.title);

  const today = currentDayIndex(challenge);
  const { done, total, streak } = useMemo(() => computeStats(challenge), [challenge]);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  // Optimistic day update helper — mutates local state then syncs to server
  const patchDay = useCallback(
    (dayIndex: number, next: ChallengeDay) => {
      setChallenge((prev) => {
        const days = prev.days.slice();
        days[dayIndex] = next;
        return { ...prev, days };
      });
      startTransition(async () => {
        try {
          await updateDay(challenge.id, dayIndex, next);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Couldn't save — refresh to sync");
        }
      });
    },
    [challenge.id]
  );

  async function saveTitle() {
    setEditingTitle(false);
    if (titleDraft.trim() === challenge.title) return;
    try {
      await renameChallenge(challenge.id, titleDraft);
      setChallenge({ ...challenge, title: titleDraft.trim() || "Untitled" });
      toast.success("Title updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't rename");
    }
  }

  async function handleArchive() {
    try {
      await archiveChallenge(challenge.id);
      toast.success("Challenge archived");
      router.push("/challenges");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't archive");
    }
  }
  async function handleDelete() {
    try {
      await deleteChallenge(challenge.id);
      toast.success("Challenge deleted");
      router.push("/challenges");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete");
    }
  }

  /** Copy day X's content into day Y (kanban/roadmap only). Generates fresh task ids. */
  function copyDayFromTo(fromIdx: number, toIdx: number) {
    if (fromIdx === toIdx) return;
    const src = challenge.days[fromIdx];
    if (challenge.mode === "kanban") {
      const s = src as KanbanDay;
      const cloned: KanbanDay = {
        tasks: (s.tasks ?? []).map((t) => ({ id: randId(), title: t.title, done: false })),
      };
      patchDay(toIdx, cloned);
      toast.success(`Day ${fromIdx + 1} → Day ${toIdx + 1}`);
    } else if (challenge.mode === "roadmap") {
      const s = src as RoadmapDay;
      const cloned: RoadmapDay = {
        goals: (s.goals ?? []).slice(),
        done: false,
        note: undefined,
      };
      patchDay(toIdx, cloned);
      toast.success(`Day ${fromIdx + 1} → Day ${toIdx + 1}`);
    }
  }

  /** Apply day X's content to ALL remaining days (today onward, not completed). */
  async function applyDayToAllRemaining(fromIdx: number) {
    const src = challenge.days[fromIdx];
    let count = 0;
    const newDays = challenge.days.map((d, i) => {
      if (i <= fromIdx || i < today) return d;
      count++;
      if (challenge.mode === "kanban") {
        const s = src as KanbanDay;
        return { tasks: (s.tasks ?? []).map((t) => ({ id: randId(), title: t.title, done: false })) } as KanbanDay;
      }
      if (challenge.mode === "roadmap") {
        const s = src as RoadmapDay;
        return { goals: (s.goals ?? []).slice(), done: false } as RoadmapDay;
      }
      return d;
    });
    setChallenge({ ...challenge, days: newDays });
    try {
      // Bulk update — loop updateDay (server action). Small N so acceptable.
      for (let i = fromIdx + 1; i < newDays.length; i++) {
        if (i < today) continue;
        await updateDay(challenge.id, i, newDays[i] as Partial<ChallengeDay>);
      }
      toast.success(`Copied Day ${fromIdx + 1} to ${count} upcoming day(s)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Partial save — refresh");
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        title={editingTitle ? "" : challenge.title}
        description={
          editingTitle ? undefined :
          `${challenge.mode === "habit" ? "Habit tracker" : challenge.mode === "kanban" ? "Kanban plan" : "Roadmap"} · ${challenge.duration_days} days · Started ${format(parseISO(challenge.started_at), "MMM d, yyyy")}`
        }
        backHref="/challenges"
        backLabel="All challenges"
        actions={
          <>
            {!editingTitle && (
              <Button variant="outline" size="sm" onClick={() => { setTitleDraft(challenge.title); setEditingTitle(true); }}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                Rename
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleArchive}>
              Archive
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmDelete(true)} className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        }
      />

      {editingTitle && (
        <div className="flex gap-2">
          <input
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
            className="w-full rounded-lg border border-indigo-300 bg-white px-3 py-2 text-xl font-bold focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-indigo-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
          <Button onClick={saveTitle}><Check className="h-4 w-4" /></Button>
        </div>
      )}

      {/* Stats bar */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat icon={<Target className="h-4 w-4" />} label="Progress" value={`${pct}%`} hint={`${done} / ${total}`} />
        <Stat icon={<Flame className="h-4 w-4" />} label="Current streak" value={String(streak)} hint="days in a row" />
        <Stat icon={<CalIcon className="h-4 w-4" />} label="Today" value={`Day ${today + 1}`} hint={dayLabel(challenge.started_at, today)} />
        <Stat icon={modeIcon(challenge.mode)} label="Mode" value={challenge.mode} hint={`${challenge.duration_days}-day challenge`} />
      </div>

      {/* Mode-specific renderers */}
      {challenge.mode === "habit" && <HabitGrid challenge={challenge} today={today} patchDay={patchDay} />}
      {challenge.mode === "kanban" && (
        <KanbanDays
          challenge={challenge}
          today={today}
          patchDay={patchDay}
          onCopyFromTo={copyDayFromTo}
          onApplyToAll={applyDayToAllRemaining}
        />
      )}
      {challenge.mode === "roadmap" && (
        <RoadmapDays
          challenge={challenge}
          today={today}
          patchDay={patchDay}
          onCopyFromTo={copyDayFromTo}
          onApplyToAll={applyDayToAllRemaining}
        />
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this challenge?"
        description={`"${challenge.title}" and all ${challenge.duration_days} days will be permanently removed.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
      />
    </div>
  );
}

function modeIcon(mode: Challenge["mode"]) {
  if (mode === "habit") return <CheckCircle2 className="h-4 w-4" />;
  if (mode === "kanban") return <Columns3 className="h-4 w-4" />;
  return <Map className="h-4 w-4" />;
}

function Stat({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardDescription className="flex items-center gap-1 text-[11px] uppercase tracking-wider">
          {icon}
          {label}
        </CardDescription>
        <CardTitle className="text-2xl capitalize">{value}</CardTitle>
      </CardHeader>
      {hint && <CardContent className="pb-3 pt-0"><p className="text-xs text-zinc-500 dark:text-zinc-400">{hint}</p></CardContent>}
    </Card>
  );
}

// ─── HABIT grid ──────────────────────────────────────────────────
function HabitGrid({ challenge, today, patchDay }: { challenge: Challenge; today: number; patchDay: (i: number, n: ChallengeDay) => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Check off each day</CardTitle>
        <CardDescription>Tap a cell to mark that day done. Future days are locked until the date arrives.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-7 md:grid-cols-10 lg:grid-cols-14">
          {challenge.days.map((d, i) => {
            const hd = d as HabitDay;
            const isToday = i === today;
            const isFuture = i > today;
            return (
              <button
                key={i}
                type="button"
                disabled={isFuture}
                onClick={() => patchDay(i, { done: !hd.done } as HabitDay)}
                className={`flex aspect-square flex-col items-center justify-center rounded-lg border text-xs font-medium transition ${
                  hd.done
                    ? "border-emerald-400 bg-emerald-500 text-white"
                    : isFuture
                    ? "cursor-not-allowed border-dashed border-zinc-200 bg-zinc-50 text-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-700"
                    : "border-zinc-300 bg-white hover:border-emerald-400 hover:bg-emerald-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-emerald-600 dark:hover:bg-emerald-950/30"
                } ${isToday ? "ring-2 ring-indigo-500 ring-offset-1 dark:ring-offset-zinc-900" : ""}`}
                title={dayLabel(challenge.started_at, i)}
              >
                <span className="text-[10px] opacity-70">D{i + 1}</span>
                {hd.done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── KANBAN per-day tasks ────────────────────────────────────────
function KanbanDays({
  challenge, today, patchDay, onCopyFromTo, onApplyToAll,
}: {
  challenge: Challenge; today: number;
  patchDay: (i: number, n: ChallengeDay) => void;
  onCopyFromTo: (from: number, to: number) => void;
  onApplyToAll: (from: number) => void;
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
      {challenge.days.map((d, i) => (
        <DayKanbanCard
          key={i}
          index={i}
          today={today}
          day={d as KanbanDay}
          challenge={challenge}
          onChange={(n) => patchDay(i, n)}
          onCopyFrom={(from) => onCopyFromTo(from, i)}
          onApplyToAll={() => onApplyToAll(i)}
        />
      ))}
    </div>
  );
}

function DayKanbanCard({
  index, today, day, challenge, onChange, onCopyFrom, onApplyToAll,
}: {
  index: number; today: number; day: KanbanDay; challenge: Challenge;
  onChange: (d: KanbanDay) => void;
  onCopyFrom: (from: number) => void;
  onApplyToAll: () => void;
}) {
  const [newTitle, setNewTitle] = useState("");
  const isToday = index === today;
  const isPast = index < today;
  const tasks = day.tasks ?? [];
  const allDone = tasks.length > 0 && tasks.every((t) => t.done);

  function addTask() {
    if (!newTitle.trim()) return;
    onChange({ tasks: [...tasks, { id: randId(), title: newTitle.trim(), done: false }] });
    setNewTitle("");
  }
  function toggleTask(id: string) {
    onChange({ tasks: tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) });
  }
  function renameTask(id: string, title: string) {
    onChange({ tasks: tasks.map((t) => (t.id === id ? { ...t, title } : t)) });
  }
  function removeTask(id: string) {
    onChange({ tasks: tasks.filter((t) => t.id !== id) });
  }

  return (
    <Card className={`${isToday ? "ring-2 ring-indigo-500" : ""} ${allDone ? "opacity-80" : ""}`}>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm">
            Day {index + 1}
            {allDone && <Check className="ml-1 inline h-3.5 w-3.5 text-emerald-500" strokeWidth={3} />}
          </CardTitle>
          <CardDescription className="text-xs">
            {dayLabel(challenge.started_at, index)}
            {isPast && !allDone && <span className="ml-1 text-red-500">· missed</span>}
          </CardDescription>
        </div>
        <DayActionsMenu
          currentIndex={index}
          challenge={challenge}
          onCopyFrom={onCopyFrom}
          onApplyToAll={onApplyToAll}
        />
      </CardHeader>
      <CardContent className="space-y-2">
        {tasks.length === 0 && (
          <p className="text-xs italic text-zinc-400">No tasks yet. Add one below, or copy from another day.</p>
        )}
        {tasks.map((t) => (
          <KanbanTaskRow
            key={t.id}
            task={t}
            onToggle={() => toggleTask(t.id)}
            onRename={(title) => renameTask(t.id, title)}
            onRemove={() => removeTask(t.id)}
          />
        ))}
        <div className="flex gap-1.5 pt-1">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addTask(); }}
            placeholder="Add a task…"
            className="flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
          <Button size="sm" variant="outline" onClick={addTask} disabled={!newTitle.trim()}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function KanbanTaskRow({
  task, onToggle, onRename, onRemove,
}: {
  task: ChallengeTask;
  onToggle: () => void;
  onRename: (t: string) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  return (
    <div className="group flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
      <button
        type="button"
        onClick={onToggle}
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 ${
          task.done
            ? "border-emerald-500 bg-emerald-500 text-white"
            : "border-zinc-300 dark:border-zinc-600"
        }`}
        aria-label={task.done ? "Uncheck" : "Check"}
      >
        {task.done && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
      </button>
      {editing ? (
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => { setEditing(false); if (draft.trim() && draft !== task.title) onRename(draft.trim()); }}
          onKeyDown={(e) => {
            if (e.key === "Enter") { setEditing(false); if (draft.trim() && draft !== task.title) onRename(draft.trim()); }
            if (e.key === "Escape") { setEditing(false); setDraft(task.title); }
          }}
          autoFocus
          className="flex-1 rounded bg-transparent px-1 py-0.5 text-xs outline-none ring-1 ring-indigo-400"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={`flex-1 cursor-text truncate rounded px-1 text-left text-xs ${
            task.done ? "text-zinc-400 line-through" : "text-zinc-800 dark:text-zinc-200"
          }`}
        >
          {task.title}
        </button>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 rounded p-0.5 text-zinc-400 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 dark:hover:bg-red-950/30"
        aria-label="Remove"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

// Day-actions popover (copy from another day / apply to remaining)
function DayActionsMenu({
  currentIndex, challenge, onCopyFrom, onApplyToAll,
}: {
  currentIndex: number; challenge: Challenge;
  onCopyFrom: (from: number) => void; onApplyToAll: () => void;
}) {
  const [open, setOpen] = useState(false);
  const isKanban = challenge.mode === "kanban";
  const isRoadmap = challenge.mode === "roadmap";
  if (!isKanban && !isRoadmap) return null;

  // Days that are NOT the current one and have some content to copy
  const eligibleSources = challenge.days.reduce<number[]>((acc, d, i) => {
    if (i === currentIndex) return acc;
    const hasContent = isKanban
      ? ((d as KanbanDay).tasks?.length ?? 0) > 0
      : ((d as RoadmapDay).goals?.length ?? 0) > 0;
    if (hasContent) acc.push(i);
    return acc;
  }, []);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          aria-label="Day actions"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-50 w-60 rounded-xl border border-zinc-200 bg-white p-2 shadow-xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 dark:border-zinc-700 dark:bg-zinc-900"
        >
          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Copy content into Day {currentIndex + 1}
          </p>
          {eligibleSources.length === 0 ? (
            <p className="px-2 py-2 text-xs text-zinc-400">No other days have content yet.</p>
          ) : (
            <div className="max-h-40 space-y-0.5 overflow-y-auto">
              {eligibleSources.map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => { onCopyFrom(i); setOpen(false); }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                >
                  <CornerDownRight className="h-3 w-3 text-zinc-400" />
                  From Day {i + 1}
                </button>
              ))}
            </div>
          )}
          <div className="mt-1 border-t border-zinc-100 pt-1 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => { onApplyToAll(); setOpen(false); }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/30"
            >
              <Copy className="h-3 w-3" />
              Apply this day to all upcoming
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ─── ROADMAP per-day goals ───────────────────────────────────────
function RoadmapDays({
  challenge, today, patchDay, onCopyFromTo, onApplyToAll,
}: {
  challenge: Challenge; today: number;
  patchDay: (i: number, n: ChallengeDay) => void;
  onCopyFromTo: (from: number, to: number) => void;
  onApplyToAll: (from: number) => void;
}) {
  return (
    <div className="space-y-2">
      {challenge.days.map((d, i) => (
        <RoadmapDayRow
          key={i}
          index={i}
          today={today}
          day={d as RoadmapDay}
          challenge={challenge}
          onChange={(n) => patchDay(i, n)}
          onCopyFrom={(from) => onCopyFromTo(from, i)}
          onApplyToAll={() => onApplyToAll(i)}
        />
      ))}
    </div>
  );
}

function RoadmapDayRow({
  index, today, day, challenge, onChange, onCopyFrom, onApplyToAll,
}: {
  index: number; today: number; day: RoadmapDay; challenge: Challenge;
  onChange: (d: RoadmapDay) => void;
  onCopyFrom: (from: number) => void;
  onApplyToAll: () => void;
}) {
  const [newGoal, setNewGoal] = useState("");
  const goals = day.goals ?? [];
  const isToday = index === today;

  function addGoal() {
    if (!newGoal.trim()) return;
    onChange({ goals: [...goals, newGoal.trim()], done: day.done });
    setNewGoal("");
  }
  function editGoal(idx: number, text: string) {
    const next = goals.slice();
    next[idx] = text;
    onChange({ goals: next, done: day.done });
  }
  function removeGoal(idx: number) {
    onChange({ goals: goals.filter((_, i) => i !== idx), done: day.done });
  }
  function toggleDone() {
    onChange({ goals, done: !day.done });
  }

  return (
    <Card className={isToday ? "border-indigo-400 ring-2 ring-indigo-500/30" : ""}>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleDone}
            className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
              day.done
                ? "border-indigo-600 bg-indigo-600 text-white"
                : "border-zinc-300 dark:border-zinc-600"
            }`}
            aria-label="Toggle day complete"
          >
            {day.done && <Check className="h-3 w-3" strokeWidth={3} />}
          </button>
          <div>
            <CardTitle className="text-sm">Day {index + 1}</CardTitle>
            <CardDescription className="text-xs">{dayLabel(challenge.started_at, index)}</CardDescription>
          </div>
        </div>
        <DayActionsMenu
          currentIndex={index}
          challenge={challenge}
          onCopyFrom={onCopyFrom}
          onApplyToAll={onApplyToAll}
        />
      </CardHeader>
      <CardContent className="space-y-1.5">
        {goals.length === 0 && <p className="text-xs italic text-zinc-400">No goals yet. Add one below.</p>}
        {goals.map((g, gi) => (
          <RoadmapGoalRow
            key={gi}
            value={g}
            onChange={(v) => editGoal(gi, v)}
            onRemove={() => removeGoal(gi)}
          />
        ))}
        <div className="flex gap-1.5">
          <input
            value={newGoal}
            onChange={(e) => setNewGoal(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addGoal(); }}
            placeholder="Add a goal…"
            className="flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
          <Button size="sm" variant="outline" onClick={addGoal} disabled={!newGoal.trim()}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RoadmapGoalRow({ value, onChange, onRemove }: { value: string; onChange: (v: string) => void; onRemove: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  return (
    <div className="group flex items-center gap-2 rounded px-1.5 py-0.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
      <span className="text-zinc-400">•</span>
      {editing ? (
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => { setEditing(false); if (draft.trim() && draft !== value) onChange(draft.trim()); }}
          onKeyDown={(e) => {
            if (e.key === "Enter") { setEditing(false); if (draft.trim() && draft !== value) onChange(draft.trim()); }
            if (e.key === "Escape") { setEditing(false); setDraft(value); }
          }}
          autoFocus
          className="flex-1 rounded bg-transparent px-1 text-xs outline-none ring-1 ring-indigo-400"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex-1 cursor-text truncate rounded text-left text-xs text-zinc-800 dark:text-zinc-200"
        >
          {value}
        </button>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 rounded p-0.5 text-zinc-400 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 dark:hover:bg-red-950/30"
        aria-label="Remove"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
