"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { formatDistanceToNow, format } from "date-fns";
import { History, X, Pencil, Type, Eye } from "lucide-react";
import { getPageHistory, type PageHistory } from "@/lib/notes/history-actions";

interface Props {
  pageId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ACTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  edited: Pencil,
  renamed: Type,
  viewed: Eye,
};

const ACTION_LABELS: Record<string, string> = {
  edited: "edited this page",
  renamed: "renamed this page",
  created: "created this page",
};

function Initials({ name }: { name: string | null }) {
  const letter = (name?.trim().charAt(0) || "?").toUpperCase();
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-[11px] font-semibold text-white">
      {letter}
    </div>
  );
}

export function NoteHistoryPanel({ pageId, open, onOpenChange }: Props) {
  const [history, setHistory] = useState<PageHistory | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getPageHistory(pageId)
      .then(setHistory)
      .catch(() => setHistory(null))
      .finally(() => setLoading(false));
  }, [open, pageId]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-md flex-col border-l border-zinc-200 bg-white shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
            <div>
              <Dialog.Title className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-50">
                <History className="h-4 w-4" />
                Page history
              </Dialog.Title>
              <Dialog.Description className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                Who created this page, who's edited it, and when.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="p-5 text-center text-sm text-zinc-400">Loading history…</div>
            )}
            {!loading && !history && (
              <div className="p-5 text-center text-sm text-zinc-400">No history available.</div>
            )}
            {!loading && history && (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {/* Created */}
                {history.createdBy && (
                  <div className="flex items-start gap-3 px-5 py-3">
                    <Initials name={history.createdBy.name} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">
                          {history.createdBy.name ?? "Someone"}
                        </span>{" "}
                        <span className="text-zinc-500 dark:text-zinc-400">created this page</span>
                      </p>
                      {history.createdAt && (
                        <p className="mt-0.5 text-xs text-zinc-400" title={format(new Date(history.createdAt), "PPpp")}>
                          {formatDistanceToNow(new Date(history.createdAt), { addSuffix: true })}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Last edit summary (only when different from create) */}
                {history.lastEditedBy &&
                  history.lastEditedAt &&
                  history.lastEditedAt !== history.createdAt && (
                    <div className="flex items-start gap-3 bg-indigo-50/30 px-5 py-3 dark:bg-indigo-950/10">
                      <Initials name={history.lastEditedBy.name} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">
                          <span className="font-medium text-zinc-900 dark:text-zinc-100">
                            {history.lastEditedBy.name ?? "Someone"}
                          </span>{" "}
                          <span className="text-zinc-500 dark:text-zinc-400">most recent edit</span>
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-400" title={format(new Date(history.lastEditedAt), "PPpp")}>
                          {formatDistanceToNow(new Date(history.lastEditedAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  )}

                {/* Activity timeline */}
                {history.entries.length > 0 && (
                  <div>
                    <p className="border-t border-zinc-100 bg-zinc-50 px-5 py-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
                      Recent activity ({history.entries.length})
                    </p>
                    {history.entries.map((e) => {
                      const Icon = ACTION_ICONS[e.action] ?? Pencil;
                      return (
                        <div key={e.id} className="flex items-start gap-3 px-5 py-2.5">
                          <Initials name={e.userName} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm">
                              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                                {e.userName ?? "Someone"}
                              </span>{" "}
                              <span className="text-zinc-500 dark:text-zinc-400">
                                {ACTION_LABELS[e.action] ?? e.action}
                              </span>
                            </p>
                            <p
                              className="mt-0.5 flex items-center gap-1 text-xs text-zinc-400"
                              title={format(new Date(e.createdAt), "PPpp")}
                            >
                              <Icon className="h-3 w-3" />
                              {formatDistanceToNow(new Date(e.createdAt), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {history.entries.length === 0 && (
                  <p className="px-5 py-6 text-center text-xs text-zinc-400">
                    No edits logged yet. As teammates edit this page, their changes will appear here.
                  </p>
                )}
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
