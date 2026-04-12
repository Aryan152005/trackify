"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, LogOut, Trash2, Crown, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { deleteWorkspace, leaveWorkspace, transferOwnership } from "@/lib/workspace/actions";
import type { WorkspaceRole } from "@/lib/types/workspace";

interface DangerZoneProps {
  workspaceId: string;
  workspaceName: string;
  isPersonal: boolean;
  role: WorkspaceRole | null;
  members: Array<{ user_id: string; name: string; role: WorkspaceRole }>;
}

export function DangerZone({ workspaceId, workspaceName, isPersonal, role, members }: DangerZoneProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<"leave" | "delete" | "transfer" | null>(null);
  const [transferTo, setTransferTo] = useState("");

  const isOwner = role === "owner";
  const isMember = !!role;

  if (!isMember) return null;

  async function handleDelete() {
    const confirmText = `DELETE ${workspaceName}`;
    const typed = prompt(
      `This permanently deletes "${workspaceName}" and every page, board, task, note, drawing, etc. in it. This cannot be undone.\n\nType ${confirmText} to confirm:`
    );
    if (typed !== confirmText) return;
    setBusy("delete");
    try {
      await deleteWorkspace(workspaceId);
      toast.success("Workspace deleted");
      // Full reload to reset the workspace context to a valid one.
      window.location.href = "/dashboard";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete workspace");
      setBusy(null);
    }
  }

  async function handleLeave() {
    if (!confirm(`Leave "${workspaceName}"? You'll lose access to everything in it.`)) return;
    setBusy("leave");
    try {
      await leaveWorkspace(workspaceId);
      toast.success(`Left "${workspaceName}"`);
      window.location.href = "/dashboard";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't leave workspace");
      setBusy(null);
    }
  }

  async function handleTransfer() {
    if (!transferTo) return;
    const picked = members.find((m) => m.user_id === transferTo);
    if (!picked) return;
    if (!confirm(`Transfer ownership of "${workspaceName}" to ${picked.name}? You'll become admin.`)) return;
    setBusy("transfer");
    try {
      await transferOwnership(workspaceId, transferTo);
      toast.success(`Ownership transferred to ${picked.name}`);
      setTransferTo("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't transfer ownership");
    } finally {
      setBusy(null);
    }
  }

  const transferCandidates = members.filter((m) => m.role !== "owner");

  return (
    <Card className="border-red-200 dark:border-red-900/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-red-700 dark:text-red-400">
          <AlertTriangle className="h-4 w-4" />
          Danger zone
        </CardTitle>
        <CardDescription>Destructive actions. Read carefully.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Leave workspace — available to every non-owner, non-personal */}
        {!isPersonal && !isOwner && (
          <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Leave this workspace</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">You&apos;ll lose access to its content immediately.</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleLeave} disabled={busy === "leave"} className="gap-1.5">
              {busy === "leave" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
              Leave
            </Button>
          </div>
        )}

        {/* Transfer ownership — owner only, non-personal, at least one other member */}
        {!isPersonal && isOwner && transferCandidates.length > 0 && (
          <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Transfer ownership</p>
            <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
              Pick a member to become the new owner. You&apos;ll become admin.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                value={transferTo}
                onChange={(e) => setTransferTo(e.target.value)}
                className="h-9 flex-1 rounded-md border border-zinc-200 bg-white px-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              >
                <option value="">Pick a member…</option>
                {transferCandidates.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.name} · {m.role}
                  </option>
                ))}
              </select>
              <Button
                variant="outline"
                size="sm"
                disabled={!transferTo || busy === "transfer"}
                onClick={handleTransfer}
                className="gap-1.5"
              >
                {busy === "transfer" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Crown className="h-3.5 w-3.5" />}
                Transfer
              </Button>
            </div>
          </div>
        )}

        {/* Delete workspace — owner only, non-personal */}
        {!isPersonal && isOwner && (
          <div className="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50/30 p-3 dark:border-red-900/40 dark:bg-red-950/10 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-red-700 dark:text-red-400">Delete this workspace</p>
              <p className="text-xs text-red-600/80 dark:text-red-400/80">
                Permanently removes everything in it. Cannot be undone.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              disabled={busy === "delete"}
              className="gap-1.5 border-red-300 text-red-700 hover:bg-red-100 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              {busy === "delete" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Delete workspace
            </Button>
          </div>
        )}

        {isPersonal && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            This is your personal workspace — it cannot be deleted or left.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
