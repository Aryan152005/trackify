"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { toast } from "sonner";
import {
  Bell, CalendarDays, CheckCircle2, ChevronRight, ExternalLink, Loader2, Pencil,
  Plus, Send, Sparkles, Trash2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { quickCapture, deleteCaptured, renameCaptured } from "@/lib/today/actions";
import { parseCapture, type ParsedKind } from "@/lib/today/parse";
import { TokenHighlightInput } from "@/components/today/token-highlight-input";

/**
 * Floating capture sheet — single entry point for creating a task, reminder,
 * or calendar event from one natural-language line.
 *
 * Upgrade over the single-shot version:
 *   1. LIVE PARSE PREVIEW as the user types — pure client, no round-trip.
 *      Shows which kind we'd commit, the detected date/time, and a plain-
 *      English rationale.
 *   2. SEGMENTED OVERRIDE — "actually, this is an event" — forces the kind.
 *   3. RECENT CAPTURES panel inside the same sheet with Open / Rename / Delete
 *      so an "oops I meant Friday" can be fixed without navigating away.
 */

const KIND_LABEL: Record<ParsedKind, string> = {
  task: "Task",
  reminder: "Reminder",
  event: "Event",
};

const KIND_ICON: Record<ParsedKind, React.ComponentType<{ className?: string }>> = {
  task: CheckCircle2,
  reminder: Bell,
  event: CalendarDays,
};

const KIND_HREF: Record<ParsedKind, (id: string) => string> = {
  task: (id) => `/tasks/${id}`,
  reminder: () => `/reminders`,
  event: () => `/calendar`,
};

const KIND_ACCENT: Record<ParsedKind, string> = {
  task: "text-indigo-600 dark:text-indigo-400",
  reminder: "text-amber-600 dark:text-amber-400",
  event: "text-purple-600 dark:text-purple-400",
};

interface RecentItem {
  id: string;
  kind: ParsedKind;
  title: string;
  createdAt: number;
}

const RECENT_CAP = 5;

export function GlobalCaptureFab() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [override, setOverride] = useState<ParsedKind | null>(null);
  const [pending, startTransition] = useTransition();
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [renamingBusy, setRenamingBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<RecentItem | null>(null);

  // Live parse preview — cheap, so we recompute on every keystroke.
  const preview = useMemo(() => parseCapture(value), [value]);
  const effectiveKind: ParsedKind = override ?? preview.kind;
  const KindIcon = KIND_ICON[effectiveKind];

  // Keyboard: "c" when not focused in an input opens the sheet.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const inInput =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (!inInput && e.key.toLowerCase() === "c" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function resetForm() {
    setValue("");
    setOverride(null);
  }

  function submit() {
    const text = value.trim();
    if (!text) return;
    startTransition(async () => {
      try {
        const res = await quickCapture(text, override ? { forceKind: override } : {});
        toast.success(
          res.kind === "reminder" ? "Reminder set"
          : res.kind === "event" ? "Event added"
          : "Task added",
          {
            icon: res.kind === "reminder"
              ? <Bell className="h-4 w-4 text-amber-500" />
              : res.kind === "event"
              ? <CalendarDays className="h-4 w-4 text-purple-500" />
              : <CheckCircle2 className="h-4 w-4 text-indigo-500" />,
          },
        );
        setRecent((prev) => [
          { id: res.id, kind: res.kind, title: res.title, createdAt: Date.now() },
          ...prev.slice(0, RECENT_CAP - 1),
        ]);
        resetForm();
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't save");
      }
    });
  }

  function startRename(item: RecentItem) {
    setRenamingId(item.id);
    setRenameDraft(item.title);
  }

  async function commitRename() {
    const target = recent.find((r) => r.id === renamingId);
    if (!target || !renameDraft.trim()) {
      setRenamingId(null);
      return;
    }
    setRenamingBusy(true);
    try {
      await renameCaptured(target.kind, target.id, renameDraft.trim());
      setRecent((prev) =>
        prev.map((r) => (r.id === target.id ? { ...r, title: renameDraft.trim() } : r)),
      );
      toast.success("Renamed");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't rename");
    } finally {
      setRenamingBusy(false);
      setRenamingId(null);
    }
  }

  async function performDelete() {
    const item = confirmDelete;
    if (!item) return;
    setConfirmDelete(null);
    try {
      await deleteCaptured(item.kind, item.id);
      setRecent((prev) => prev.filter((r) => r.id !== item.id));
      toast.success("Deleted");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete");
    }
  }

  return (
    <>
      {/* Floating trigger — bottom-right, above safe-area on mobile */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Quick capture (press C)"
        title="Quick capture — press C"
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+1.25rem)] right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg transition-transform hover:scale-105 hover:bg-indigo-700 active:scale-95 dark:bg-indigo-500 dark:hover:bg-indigo-400 sm:h-14 sm:w-14"
      >
        <Plus className="h-6 w-6" strokeWidth={2.5} />
      </button>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in" />
          <Dialog.Content className="sheet-on-mobile fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-zinc-200 bg-white p-5 shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:zoom-in-95 dark:border-zinc-800 dark:bg-zinc-900">
            <Dialog.Title className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-50">
              <Sparkles className="h-4 w-4 text-indigo-500" />
              Quick capture
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Type a line — we&apos;ll guess task / reminder / event. Override below if we&apos;re wrong.
            </Dialog.Description>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
              className="mt-4 space-y-3"
            >
              <TokenHighlightInput
                value={value}
                onChange={(next) => {
                  setValue(next);
                  setOverride(null); // fresh text clears any prior override
                }}
                autoFocus
                disabled={pending}
                onEnter={submit}
                placeholder='e.g. "call supplier 3pm tomorrow #work p1"'
                className="w-full"
                inputClassName="rounded-lg border border-zinc-300 bg-white px-3 py-2.5 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/30 dark:border-zinc-600 dark:bg-zinc-800"
              />

              {/* Live parse preview — shows as soon as the user types. */}
              {value.trim() && (
                <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
                  <div className="flex items-center gap-2">
                    <KindIcon className={`h-4 w-4 shrink-0 ${KIND_ACCENT[effectiveKind]}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                        Will create: {KIND_LABEL[effectiveKind]}
                        {override && <span className="ml-1 rounded bg-indigo-100 px-1 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">your choice</span>}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                        {preview.reasoning}
                      </p>
                    </div>
                  </div>

                  <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-[11px]">
                    <dt className="text-zinc-500 dark:text-zinc-400">Title:</dt>
                    <dd className="truncate text-zinc-800 dark:text-zinc-200">{preview.title || value.trim()}</dd>
                    {preview.dateKey && (
                      <>
                        <dt className="text-zinc-500 dark:text-zinc-400">When:</dt>
                        <dd className="text-zinc-800 dark:text-zinc-200">
                          {preview.dateKey}
                          {preview.time ? ` · ${preview.time} IST` : ""}
                        </dd>
                      </>
                    )}
                  </dl>

                  {/* Segmented override — "did you mean?" */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-1">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Change to:
                    </span>
                    {(["task", "reminder", "event"] as ParsedKind[]).map((k) => {
                      const Icon = KIND_ICON[k];
                      const active = effectiveKind === k;
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setOverride(k)}
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition ${
                            active
                              ? "border-indigo-400 bg-indigo-50 text-indigo-700 dark:border-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300"
                              : "border-zinc-300 bg-white text-zinc-600 hover:border-indigo-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
                          }`}
                        >
                          <Icon className="h-3 w-3" />
                          {KIND_LABEL[k]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={pending || !value.trim()}>
                  {pending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
                  Create {KIND_LABEL[effectiveKind].toLowerCase()}
                </Button>
              </div>
            </form>

            {/* ── Recent captures in this session — full CRUD ─────────── */}
            {recent.length > 0 && (
              <div className="mt-5 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Just captured
                </p>
                <ul className="space-y-1">
                  {recent.map((item) => {
                    const Icon = KIND_ICON[item.kind];
                    const isRenaming = renamingId === item.id;
                    return (
                      <li
                        key={item.id}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        <Icon className={`h-3.5 w-3.5 shrink-0 ${KIND_ACCENT[item.kind]}`} />
                        {isRenaming ? (
                          <input
                            type="text"
                            value={renameDraft}
                            onChange={(e) => setRenameDraft(e.target.value)}
                            onBlur={commitRename}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                commitRename();
                              } else if (e.key === "Escape") {
                                setRenamingId(null);
                              }
                            }}
                            autoFocus
                            disabled={renamingBusy}
                            className="min-w-0 flex-1 rounded-sm border border-indigo-300 bg-white px-1 py-0.5 text-sm text-zinc-900 focus:border-indigo-500 focus:outline-none dark:border-indigo-600 dark:bg-zinc-900 dark:text-zinc-100"
                          />
                        ) : (
                          <span className="min-w-0 flex-1 truncate text-zinc-800 dark:text-zinc-200" title={item.title}>
                            {item.title}
                          </span>
                        )}
                        <span className="shrink-0 text-[10px] uppercase tracking-wide text-zinc-400">
                          {KIND_LABEL[item.kind]}
                        </span>
                        <Link
                          href={KIND_HREF[item.kind](item.id)}
                          onClick={() => setOpen(false)}
                          className="rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                          title="Open"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => (isRenaming ? setRenamingId(null) : startRename(item))}
                          className="rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                          title={isRenaming ? "Cancel rename" : "Rename"}
                          disabled={renamingBusy}
                        >
                          {isRenaming ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(item)}
                          className="rounded p-1 text-zinc-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950/40"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-2 text-[11px] text-zinc-400 dark:text-zinc-500">
                  <ChevronRight className="inline h-3 w-3" />
                  This list lives for this session only — close the sheet to clear it.
                </p>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(next) => !next && setConfirmDelete(null)}
        title={`Delete this ${confirmDelete ? KIND_LABEL[confirmDelete.kind].toLowerCase() : "item"}?`}
        description={
          confirmDelete
            ? `"${confirmDelete.title}" will be permanently removed. This can't be undone.`
            : ""
        }
        confirmLabel="Delete"
        cancelLabel="Keep"
        variant="danger"
        onConfirm={performDelete}
      />
    </>
  );
}
