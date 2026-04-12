"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useWorkspaceId } from "@/lib/workspace/hooks";
import { Play, Pause, Square, Loader2, Pencil } from "lucide-react";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { toast } from "sonner";
import {
  setActiveTimer, getActiveTimer, subscribeTimer, computeElapsed, formatElapsed,
  type ActiveTimer,
} from "@/lib/timer/store";
import {
  getRecentTimerSessions, getTodayTimerTotal, updateTimerSessionTitle,
  type TimerSessionRow,
} from "@/lib/timer/actions";

export function TimerWidget() {
  const workspaceId = useWorkspaceId();
  const [active, setActive] = useState<ActiveTimer | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);

  const [titleInput, setTitleInput] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

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

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const [s, t] = await Promise.all([getRecentTimerSessions(5), getTodayTimerTotal()]);
      setSessions(s);
      setTodayTotal(t);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory, active]);

  async function handleStart() {
    if (busy) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Sign in first"); return; }
      const trimmed = titleInput.trim() || null;
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
      setTitleInput("");
      toast.success(trimmed ? `Focus started: ${trimmed}` : "Focus timer started");
    } finally {
      setBusy(false);
    }
  }

  function handlePause() {
    if (!active || active.pausedAt) return;
    setActiveTimer({ ...active, pausedAt: Date.now() });
  }

  function handleResume() {
    if (!active || !active.pausedAt) return;
    const pauseDuration = Date.now() - active.pausedAt;
    setActiveTimer({
      ...active,
      startedAt: active.startedAt + pauseDuration,
      pausedAt: undefined,
    });
  }

  async function handleStop() {
    if (busy || !active) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const duration = computeElapsed(active);
      await supabase
        .from("timer_sessions")
        .update({
          duration_seconds: duration,
          ended_at: new Date().toISOString(),
        })
        .eq("id", active.sessionId);
      setActiveTimer(null);
      toast.success(`Session saved: ${formatElapsed(duration)}`);
      await loadHistory();
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
      toast.error("Couldn't save label");
    }
  }

  const elapsed = active ? computeElapsed(active, now) : 0;
  const isPaused = !!active?.pausedAt;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span>Focus Timer</span>
          <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400 tabular-nums">
            Today: {formatElapsed(todayTotal)}
          </span>
        </CardTitle>
        <CardDescription>Track your focus sessions with optional labels.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Clock + title */}
        <div className="text-center">
          <div
            className={`mb-1 text-4xl font-bold tabular-nums ${
              isPaused ? "text-amber-600 dark:text-amber-400" : "text-indigo-600 dark:text-indigo-400"
            }`}
          >
            {formatElapsed(elapsed)}
          </div>
          {active && (
            editingTitle ? (
              <input
                type="text"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveTitle();
                  if (e.key === "Escape") setEditingTitle(false);
                }}
                placeholder="Label this session…"
                autoFocus
                className="mx-auto block w-full max-w-[220px] rounded-md border border-indigo-300 bg-white px-2 py-1 text-center text-xs text-zinc-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-indigo-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            ) : active.title ? (
              <button
                type="button"
                onClick={() => { setTitleDraft(active.title ?? ""); setEditingTitle(true); }}
                className="mx-auto flex items-center gap-1 rounded px-2 py-0.5 text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                title="Click to rename"
              >
                {active.title}
                <Pencil className="h-2.5 w-2.5 opacity-60" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => { setTitleDraft(""); setEditingTitle(true); }}
                className="mx-auto flex items-center gap-1 rounded px-2 py-0.5 text-xs text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              >
                <Pencil className="h-2.5 w-2.5" />
                Add a label
              </button>
            )
          )}
          {isPaused && (
            <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
              Paused
            </p>
          )}
        </div>

        {/* Controls */}
        {!active ? (
          <div className="space-y-2">
            <input
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleStart(); }}
              placeholder="What are you working on? (optional)"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
            <Button onClick={handleStart} className="w-full" disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              Start focus
            </Button>
          </div>
        ) : (
          <div className="flex justify-center gap-2">
            {isPaused ? (
              <Button onClick={handleResume} size="sm" disabled={busy}>
                <Play className="mr-2 h-4 w-4" />
                Resume
              </Button>
            ) : (
              <Button onClick={handlePause} variant="outline" size="sm" disabled={busy}>
                <Pause className="mr-2 h-4 w-4" />
                Pause
              </Button>
            )}
            <Button onClick={handleStop} variant="destructive" size="sm" disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Square className="mr-2 h-4 w-4" />}
              Stop & save
            </Button>
          </div>
        )}

        {/* Inline history (recent 5) */}
        <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Recent sessions
          </p>
          {loadingHistory ? (
            <p className="py-2 text-center text-xs text-zinc-400">Loading…</p>
          ) : sessions.length === 0 ? (
            <p className="py-2 text-center text-xs text-zinc-400">
              No completed sessions yet. Start one above.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {sessions.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-md border border-zinc-100 px-2.5 py-1.5 text-xs dark:border-zinc-800"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-zinc-700 dark:text-zinc-300">
                      {s.title || <span className="text-zinc-400 italic">Untitled</span>}
                    </p>
                    <p className="text-[10px] text-zinc-400" title={format(parseISO(s.started_at), "PPpp")}>
                      {formatDistanceToNow(parseISO(s.started_at), { addSuffix: true })}
                    </p>
                  </div>
                  <span className="shrink-0 tabular-nums font-medium text-indigo-600 dark:text-indigo-400">
                    {formatElapsed(s.duration_seconds)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
