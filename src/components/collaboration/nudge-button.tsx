"use client";

import { useState, useCallback, useEffect } from "react";
import * as Popover from "@radix-ui/react-popover";
import { BellRing, MessageSquare, Pencil, Eye, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { listWorkspaceTeammates, nudgeTeammate } from "@/lib/collaboration/nudge-actions";
import { useWorkspaceId } from "@/lib/workspace/hooks";

interface Props {
  entityType: "page" | "task" | "board" | "entry" | "drawing" | "mindmap" | "challenge";
  entityId: string;
  entityTitle: string;
}

interface Teammate {
  user_id: string;
  name: string;
  avatar_url: string | null;
  role: string;
}

const ACTIONS: { id: "join" | "view" | "comment" | "edit"; label: string; Icon: typeof Eye }[] = [
  { id: "join",    label: "Come join me",   Icon: BellRing },
  { id: "comment", label: "Add a comment",  Icon: MessageSquare },
  { id: "edit",    label: "Edit this",      Icon: Pencil },
  { id: "view",    label: "Just take a look", Icon: Eye },
];

function Initials({ name }: { name: string }) {
  return (
    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-[10px] font-semibold text-white">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export function NudgeButton({ entityType, entityId, entityTitle }: Props) {
  const workspaceId = useWorkspaceId();
  const [open, setOpen] = useState(false);
  const [mates, setMates] = useState<Teammate[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState<"join" | "view" | "comment" | "edit">("join");

  const loadMates = useCallback(async () => {
    if (!workspaceId) return;
    setLoadingList(true);
    try {
      setMates(await listWorkspaceTeammates(workspaceId));
    } finally {
      setLoadingList(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (open) loadMates();
  }, [open, loadMates]);

  async function handleNudge(toUserId: string, name: string) {
    if (!workspaceId || sending) return;
    setSending(toUserId);
    try {
      const res = await nudgeTeammate({
        toUserId,
        workspaceId,
        entityType,
        entityId,
        entityTitle,
        action: selectedAction,
      });
      toast.success(
        res.pushSent > 0
          ? `Pinged ${name} on ${res.pushSent} device(s)`
          : `Notification sent to ${name} (no devices subscribed)`
      );
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send nudge");
    } finally {
      setSending(null);
    }
  }

  if (!workspaceId) return null;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-indigo-400 hover:text-indigo-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-indigo-500 dark:hover:text-indigo-300"
          title="Nudge a teammate to join you"
        >
          <BellRing className="h-3.5 w-3.5" />
          Nudge
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-50 w-80 rounded-xl border border-zinc-200 bg-white p-3 shadow-xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 dark:border-zinc-700 dark:bg-zinc-900"
        >
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Nudge a teammate
          </p>
          <p className="mb-3 text-[11px] text-zinc-500 dark:text-zinc-400">
            Sends an in-app notification + push to their subscribed devices.
          </p>

          {/* Action selector */}
          <div className="mb-3 flex flex-wrap gap-1">
            {ACTIONS.map((a) => {
              const active = selectedAction === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelectedAction(a.id)}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] transition ${
                    active
                      ? "bg-indigo-600 text-white"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  }`}
                >
                  <a.Icon className="h-3 w-3" />
                  {a.label}
                </button>
              );
            })}
          </div>

          {/* Members list */}
          <div className="max-h-[240px] overflow-y-auto border-t border-zinc-100 pt-2 dark:border-zinc-800">
            {loadingList ? (
              <p className="py-4 text-center text-xs text-zinc-400">Loading teammates…</p>
            ) : mates.length === 0 ? (
              <div className="py-5 text-center">
                <Users className="mx-auto h-6 w-6 text-zinc-300 dark:text-zinc-600" />
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  No teammates yet. Invite someone from Team Members.
                </p>
              </div>
            ) : (
              <ul className="space-y-1">
                {mates.map((m) => {
                  const busy = sending === m.user_id;
                  return (
                    <li key={m.user_id}>
                      <button
                        type="button"
                        disabled={!!sending}
                        onClick={() => handleNudge(m.user_id, m.name)}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-indigo-50 disabled:opacity-50 dark:hover:bg-indigo-950/30"
                      >
                        <Initials name={m.name} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">{m.name}</p>
                          <p className="text-[10px] uppercase tracking-wide text-zinc-400">{m.role}</p>
                        </div>
                        {busy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />
                        ) : (
                          <BellRing className="h-3.5 w-3.5 text-zinc-400" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <Popover.Arrow className="fill-white dark:fill-zinc-900" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
