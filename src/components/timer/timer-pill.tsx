"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Play, Pause, Square, History, Loader2, Pencil, Check } from "lucide-react";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { useWorkspaceId } from "@/lib/workspace/hooks";
import { toast } from "sonner";
import {
  getActiveTimer, setActiveTimer, subscribeTimer, computeElapsed, formatElapsed,
  type ActiveTimer,
} from "@/lib/timer/store";
import {
  getRecentTimerSessions, getTodayTimerTotal, updateTimerSessionTitle,
  type TimerSessionRow,
} from "@/lib/timer/actions";

export function TimerPill() {
  const workspaceId = useWorkspaceId();
  const [active, setActive] = useState<ActiveTimer | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);

  // Start popover — prompts for optional title
  const [startOpen, setStartOpen] = useState(false);
  const [titleInput, setTitleInput] = useState("");

  // Inline edit of running timer's title
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);

  // History popover
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sessions, setSessions] = useState<TimerSessionRow[]>([]);
  const [todayTotal, setTodayTotal] = useState(0);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    setActive(getActiveTimer());
    return subscribeTimer(() => setActive(getActiveTimer()));
  }, []);

  useEffect(() => {
    if (!active || active.pausedAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);

  useEffect(() => {
    if (editingTitle) titleInputRef.current?.focus();
  }, [editingTitle]);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const [s, t] = await Promise.all([getRecentTimerSessions(10), getTodayTimerTotal()]);
      setSessions(s);
      setTodayTotal(t);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (historyOpen) loadHistory();
  }, [historyOpen, loadHistory]);

  async function handleStart(title: string) {
    if (busy) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Sign in first"); return; }
      const trimmed = title.trim() || null;
      const { data, error } = await supabase
        .from("timer_sessions")
        .insert({
          user_id: user.id,
          workspace_id: workspaceId,
          started_at: new Date().toISOString(),
          duration_seconds: 0,
          title: trimmed,
        })
        .select("id")
        .single();
      if (error) { toast.error(error.message); return; }
      setActiveTimer({
        sessionId: data.id,
        startedAt: Date.now(),
        title: trimmed ?? undefined,
      });
      setStartOpen(false);
      setTitleInput("");
      toast.success(trimmed ? `Focus started: ${trimmed}` : "Focus timer started");
    } finally {
      setBusy(false);
    }
  }

  function handlePause() {
    if (!active || active.pausedAt) return;
    setActiveTimer({ ...active, pausedAt: Date.now() });
    toast.info("Timer paused");
  }

  function handleResume() {
    if (!active || !active.pausedAt) return;
    const pauseDuration = Date.now() - active.pausedAt;
    setActiveTimer({
      ...active,
      startedAt: active.startedAt + pauseDuration,
      pausedAt: undefined,
    });
    toast.success("Resumed");
  }

  async function handleStop() {
    if (busy || !active) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const duration = computeElapsed(active);
      await supabase
        .from("timer_sessions")
        .update({ duration_seconds: duration, ended_at: new Date().toISOString() })
        .eq("id", active.sessionId);
      setActiveTimer(null);
      toast.success(`Session saved: ${formatElapsed(duration)}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not stop");
    } finally {
      setBusy(false);
    }
  }

  async function saveTitle() {
    if (!active) return;
    const newTitle = titleDraft.trim();
    setActiveTimer({ ...active, title: newTitle || undefined });
    setEditingTitle(false);
    try {
      await updateTimerSessionTitle(active.sessionId, newTitle);
    } catch {
      toast.error("Couldn't save label (it'll update on stop)");
    }
  }

  const elapsed = active ? computeElapsed(active, now) : 0;
  const isPaused = !!active?.pausedAt;

  return (
    <div className="inline-flex items-center gap-1">
      {!active ? (
        <Popover.Root open={startOpen} onOpenChange={setStartOpen}>
          <Popover.Trigger asChild>
            <button
              type="button"
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-indigo-400 hover:text-indigo-700 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-indigo-500 dark:hover:text-indigo-300"
              title="Start focus timer"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              Start focus
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              align="end"
              sideOffset={6}
              className="z-50 w-72 rounded-xl border border-zinc-200 bg-white p-3 shadow-xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                What are you working on? (optional)
              </label>
              <input
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleStart(titleInput);
                  if (e.key === "Escape") setStartOpen(false);
                }}
                placeholder="e.g. Writing proposal"
                className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                autoFocus
              />
              <div className="mt-2 flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => handleStart("")}
                  className="rounded-md px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  Skip
                </button>
                <button
                  type="button"
                  onClick={() => handleStart(titleInput)}
                  disabled={busy}
                  className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                  Start
                </button>
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      ) : (
        <div
          className={`inline-flex max-w-[360px] items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium shadow-sm ${
            isPaused
              ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
              : "bg-indigo-600 text-white"
          }`}
        >
          {isPaused ? (
            <Pause className="h-3 w-3 shrink-0" fill="currentColor" />
          ) : (
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
          )}
          <span className="tabular-nums shrink-0">{formatElapsed(elapsed)}</span>

          {/* Title (editable inline) */}
          {editingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveTitle();
                if (e.key === "Escape") setEditingTitle(false);
              }}
              onBlur={saveTitle}
              placeholder="Label…"
              className="min-w-0 max-w-[160px] rounded bg-white/20 px-1.5 py-0.5 text-xs text-current placeholder-current/60 outline-none focus:bg-white/30"
            />
          ) : active.title ? (
            <button
              type="button"
              onClick={() => { setTitleDraft(active.title ?? ""); setEditingTitle(true); }}
              className="min-w-0 max-w-[160px] truncate rounded px-1 py-0.5 text-[11px] opacity-90 hover:bg-white/10"
              title="Click to rename"
            >
              {active.title}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => { setTitleDraft(""); setEditingTitle(true); }}
              className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[11px] opacity-60 hover:bg-white/10 hover:opacity-100"
              title="Add a label"
            >
              <Pencil className="h-2.5 w-2.5" />
              label
            </button>
          )}

          {/* Controls */}
          {isPaused ? (
            <button type="button" onClick={handleResume} disabled={busy} className="ml-1 rounded-full p-0.5 hover:bg-amber-200/60 dark:hover:bg-amber-900/40" title="Resume" aria-label="Resume">
              <Play className="h-3 w-3" />
            </button>
          ) : (
            <button type="button" onClick={handlePause} disabled={busy} className="ml-1 rounded-full p-0.5 hover:bg-white/20" title="Pause" aria-label="Pause">
              <Pause className="h-3 w-3" />
            </button>
          )}
          <button
            type="button"
            onClick={handleStop}
            disabled={busy}
            className={`rounded-full p-0.5 ${isPaused ? "hover:bg-amber-200/60 dark:hover:bg-amber-900/40" : "hover:bg-white/20"}`}
            title="Stop & save"
            aria-label="Stop"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Square className="h-3 w-3" fill="currentColor" />}
          </button>
        </div>
      )}

      {/* History popover */}
      <Popover.Root open={historyOpen} onOpenChange={setHistoryOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="rounded-full border border-zinc-300 bg-white p-1.5 text-zinc-500 transition hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-200"
            title="Timer history"
            aria-label="Timer history"
          >
            <History className="h-3.5 w-3.5" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="end"
            sideOffset={6}
            className="z-50 w-80 rounded-xl border border-zinc-200 bg-white p-3 shadow-xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <div className="mb-2 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Today</p>
                <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">{formatElapsed(todayTotal)}</p>
              </div>
              <p className="text-[10px] text-zinc-400">{sessions.length} recent</p>
            </div>
            <div className="max-h-[260px] overflow-y-auto">
              {loadingHistory ? (
                <p className="py-6 text-center text-xs text-zinc-400">Loading…</p>
              ) : sessions.length === 0 ? (
                <p className="py-6 text-center text-xs text-zinc-400">No completed sessions yet.</p>
              ) : (
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {sessions.map((s) => (
                    <li key={s.id} className="py-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="tabular-nums font-medium text-zinc-800 dark:text-zinc-200">
                          {formatElapsed(s.duration_seconds)}
                        </span>
                        <span className="text-zinc-500 dark:text-zinc-400" title={format(parseISO(s.started_at), "PPpp")}>
                          {formatDistanceToNow(parseISO(s.started_at), { addSuffix: true })}
                        </span>
                      </div>
                      {s.title && (
                        <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400" title={s.title}>
                          {s.title}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Popover.Arrow className="fill-white dark:fill-zinc-900" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
