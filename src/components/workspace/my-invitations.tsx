"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Mail, Check, X, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listMyInvitations, declineInvitation, type MyInvitation } from "@/lib/workspace/invitations-actions";
import { formatDistanceToNow } from "date-fns";

/**
 * Panel showing all pending invitations sent to the current user's email.
 * Includes Accept (go to the accept URL) and Decline (delete the invitation).
 */
export function MyInvitations() {
  const [invs, setInvs] = useState<MyInvitation[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await listMyInvitations();
      setInvs(data);
    } catch {
      setInvs([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDecline(id: string) {
    if (!confirm("Decline this invitation? You can be re-invited later.")) return;
    setBusy(id);
    try {
      await declineInvitation(id);
      toast.success("Invitation declined");
      setInvs((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't decline");
    } finally {
      setBusy(null);
    }
  }

  function handleAccept(token: string) {
    // Hit the accept API which joins the workspace and redirects (full-page
    // nav so the route handler's 3xx redirect actually takes effect).
    window.location.href = `/api/workspace/invite/accept?token=${token}`;
  }

  if (invs.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <Mail className="h-4 w-4 text-indigo-500" />
        <CardTitle className="text-base">
          Pending invitations for you{" "}
          <span className="ml-1 text-xs font-normal text-zinc-400">({invs.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {invs.map((i) => (
            <li key={i.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {i.workspace_name}
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {i.inviter_name ? `${i.inviter_name} invited you` : "You were invited"} as{" "}
                  <span className="font-medium">{i.role}</span> ·{" "}
                  {formatDistanceToNow(new Date(i.created_at), { addSuffix: true })}
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <Button
                  size="sm"
                  onClick={() => handleAccept(i.token)}
                  disabled={busy === i.id}
                  className="gap-1"
                >
                  <Check className="h-3.5 w-3.5" />
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDecline(i.id)}
                  disabled={busy === i.id}
                  className="gap-1"
                >
                  {busy === i.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                  Decline
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
