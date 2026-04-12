"use client";

import { useEffect, useState, useCallback } from "react";
import { useWorkspace, useRequireRole } from "@/lib/workspace/hooks";
import { updateMemberRole, removeMember } from "@/lib/workspace/actions";
import {
  getPendingInvitations,
  revokeInvitation,
  resendInvitation,
  renderInviteEmailPayload,
  bulkInviteMembers,
  type PendingInvitation,
} from "@/lib/workspace/invitations-actions";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { EmailPreviewDialog } from "@/components/admin/email-preview-dialog";
import type { RenderedEmail } from "@/lib/admin/preview-actions";
import type { WorkspaceRole } from "@/lib/types/workspace";
import { UserPlus, Shield, Trash2, Mail, Eye, RefreshCw, Copy, Check, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface MemberRow {
  id: string;
  user_id: string;
  role: WorkspaceRole;
  joined_at: string;
  name: string;
  avatar_url: string | null;
}

export default function WorkspaceMembersPage() {
  const { workspace } = useWorkspace();
  const isAdmin = useRequireRole("admin");
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [pending, setPending] = useState<PendingInvitation[]>([]);

  // Invite form
  const [inviteEmails, setInviteEmails] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer" | "admin">("editor");
  const [inviting, setInviting] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "warn" | "error"; text: string } | null>(null);

  // Preview dialog
  const [previewPayload, setPreviewPayload] = useState<RenderedEmail | null>(null);

  // Per-row action state
  const [actionId, setActionId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    if (!workspace) return;
    const supabase = createClient();
    // Two-step lookup — workspace_members.user_id FKs auth.users, so PostgREST
    // can't embed user_profiles via the FK hint (it 400s silently).
    const { data: rawMembers } = await supabase
      .from("workspace_members")
      .select("id, user_id, role, joined_at")
      .eq("workspace_id", workspace.id)
      .order("joined_at", { ascending: true });

    if (rawMembers && rawMembers.length > 0) {
      const userIds = rawMembers.map((m) => m.user_id as string);
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("user_id, name, avatar_url")
        .in("user_id", userIds);
      const pmap = new Map<string, { name: string; avatar_url: string | null }>();
      for (const p of profiles ?? []) {
        pmap.set(p.user_id as string, {
          name: (p.name as string) ?? "Unknown",
          avatar_url: (p.avatar_url as string) ?? null,
        });
      }
      setMembers(
        rawMembers.map((m) => ({
          id: m.id as string,
          user_id: m.user_id as string,
          role: m.role as WorkspaceRole,
          joined_at: m.joined_at as string,
          name: pmap.get(m.user_id as string)?.name ?? "Unknown",
          avatar_url: pmap.get(m.user_id as string)?.avatar_url ?? null,
        }))
      );
    } else {
      setMembers([]);
    }
    if (isAdmin) {
      try {
        setPending(await getPendingInvitations(workspace.id));
      } catch {
        /* silent */
      }
    }
  }, [workspace, isAdmin]);

  useEffect(() => {
    if (!workspace) return;
    loadAll();
  }, [workspace, loadAll]);

  // Live updates: re-fetch members + pending invites whenever the
  // workspace_members or workspace_invitations table changes for this workspace.
  useEffect(() => {
    if (!workspace) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`members-${workspace.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workspace_members", filter: `workspace_id=eq.${workspace.id}` },
        () => { loadAll(); }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workspace_invitations", filter: `workspace_id=eq.${workspace.id}` },
        () => { loadAll(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [workspace, loadAll]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!workspace || !inviteEmails.trim()) return;
    setInviting(true);
    setResult(null);
    const emails = inviteEmails
      .split(/[,\s\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (emails.length === 0) {
      setResult({ type: "warn", text: "Enter at least one valid email." });
      setInviting(false);
      return;
    }
    try {
      const res = await bulkInviteMembers(workspace.id, emails, inviteRole);
      const createdCount = res.created.length;
      const skippedCount = res.skipped.length;
      if (createdCount > 0) {
        setResult({
          type: skippedCount > 0 ? "warn" : "success",
          text: `${createdCount} invite(s) created${skippedCount > 0 ? `, ${skippedCount} skipped (${res.skipped.slice(0, 2).map((s) => `${s.email}: ${s.reason}`).join("; ")}${skippedCount > 2 ? "…" : ""})` : ""}.`,
        });
        setInviteEmails("");
        await loadAll();
        // Auto-open preview for the FIRST new invite
        if (res.created[0]) {
          const payload = await renderInviteEmailPayload(res.created[0].id, workspace.id);
          setPreviewPayload(payload);
        }
      } else {
        setResult({ type: "warn", text: `No invites created. ${res.skipped.map((s) => `${s.email}: ${s.reason}`).join("; ")}` });
      }
    } catch (err) {
      setResult({ type: "error", text: err instanceof Error ? err.message : "Failed to invite" });
    }
    setInviting(false);
  }

  async function handlePreview(inv: PendingInvitation) {
    if (!workspace) return;
    setActionId(inv.id);
    try {
      const payload = await renderInviteEmailPayload(inv.id, workspace.id);
      setPreviewPayload(payload);
    } catch (err) {
      setResult({ type: "error", text: err instanceof Error ? err.message : "Preview failed" });
    }
    setActionId(null);
  }

  async function handleRevoke(inv: PendingInvitation) {
    if (!workspace) return;
    if (!confirm(`Revoke invitation for ${inv.email}?`)) return;
    setActionId(inv.id);
    try {
      await revokeInvitation(inv.id, workspace.id);
      await loadAll();
    } catch (err) {
      setResult({ type: "error", text: err instanceof Error ? err.message : "Revoke failed" });
    }
    setActionId(null);
  }

  async function handleResend(inv: PendingInvitation) {
    if (!workspace) return;
    setActionId(inv.id);
    try {
      await resendInvitation(inv.id, workspace.id);
      await loadAll();
      // Open the refreshed invite preview
      const payload = await renderInviteEmailPayload(inv.id, workspace.id);
      setPreviewPayload(payload);
    } catch (err) {
      setResult({ type: "error", text: err instanceof Error ? err.message : "Resend failed" });
    }
    setActionId(null);
  }

  async function handleCopyLink(inv: PendingInvitation) {
    const appOrigin = typeof window !== "undefined" ? window.location.origin : "";
    const link = `${appOrigin}/api/workspace/invite/accept?token=${inv.token}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(inv.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setResult({ type: "error", text: "Clipboard blocked. Copy link manually from URL." });
    }
  }

  async function handleRoleChange(memberId: string, role: "admin" | "editor" | "viewer") {
    try {
      await updateMemberRole(memberId, role);
      loadAll();
    } catch { /* silent */ }
  }

  async function handleRemove(memberId: string) {
    if (!confirm("Remove this member?")) return;
    try {
      await removeMember(memberId);
      loadAll();
    } catch { /* silent */ }
  }

  if (!workspace) return null;

  const roleColors: Record<WorkspaceRole, string> = {
    owner: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    admin: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    editor: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    viewer: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300",
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Team Members"
        description={`${members.length} member${members.length === 1 ? "" : "s"} · ${pending.length} pending invite${pending.length === 1 ? "" : "s"}`}
        backHref="/workspace"
        backLabel="Back to Settings"
      />

      {result && <Alert type={result.type}>{result.text}</Alert>}

      {/* Invite form (admins only) */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlus className="h-4 w-4" /> Invite Members
            </CardTitle>
            <CardDescription>
              Enter one or more emails (comma, space, or newline separated). All get the same role.
              An invite email opens for you to copy and send.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="space-y-3">
              <textarea
                value={inviteEmails}
                onChange={(e) => setInviteEmails(e.target.value)}
                placeholder={"sarah@company.com\ndev@company.com, ops@company.com"}
                rows={3}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 sm:text-sm"
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Role</label>
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as "admin" | "editor" | "viewer")}>
                    <SelectTrigger className="w-auto"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">Viewer</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" disabled={inviting}>
                  {inviting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                  {inviting ? "Creating…" : "Create invite(s)"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Pending invitations */}
      {isAdmin && pending.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pending invitations ({pending.length})</CardTitle>
            <CardDescription>Haven&apos;t accepted yet. Share the link manually or resend if expired.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {pending.map((inv) => {
                const expired = new Date(inv.expires_at) < new Date();
                const isBusy = actionId === inv.id;
                return (
                  <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {inv.email}
                        <span className={`ml-2 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${roleColors[inv.role as WorkspaceRole] ?? ""}`}>
                          {inv.role}
                        </span>
                        {expired && (
                          <span className="ml-1.5 inline-block rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300">
                            expired
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Invited by {inv.inviter_name ?? "—"} ·{" "}
                        {expired
                          ? `expired ${formatDistanceToNow(new Date(inv.expires_at), { addSuffix: true })}`
                          : `expires ${formatDistanceToNow(new Date(inv.expires_at), { addSuffix: true })}`}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      <Button size="sm" variant="outline" onClick={() => handleCopyLink(inv)} title="Copy invite URL">
                        {copiedId === inv.id ? <Check className="mr-1 h-3.5 w-3.5 text-green-600" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
                        {copiedId === inv.id ? "Copied" : "Copy link"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handlePreview(inv)} disabled={isBusy} title="Preview & copy email">
                        <Eye className="mr-1 h-3.5 w-3.5" />
                        Preview
                      </Button>
                      {expired && (
                        <Button size="sm" onClick={() => handleResend(inv)} disabled={isBusy} title="Regenerate token + extend 7 days">
                          <RefreshCw className={`mr-1 h-3.5 w-3.5 ${isBusy ? "animate-spin" : ""}`} />
                          Resend
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => handleRevoke(inv)} disabled={isBusy} className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current members */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current members</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {members.map((member) => (
              <div key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-medium text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{member.name}</p>
                    <p className="text-xs text-zinc-500">
                      Joined {formatDistanceToNow(new Date(member.joined_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isAdmin && member.role !== "owner" ? (
                    <>
                      <Select value={member.role} onValueChange={(v) => handleRoleChange(member.id, v as "admin" | "editor" | "viewer")}>
                        <SelectTrigger className="w-auto"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="viewer">Viewer</SelectItem>
                          <SelectItem value="editor">Editor</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <button
                        onClick={() => handleRemove(member.id)}
                        className="rounded-md p-1.5 text-zinc-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                        title="Remove member"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${roleColors[member.role]}`}>
                      <Shield className="h-3 w-3" />
                      {member.role}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <EmailPreviewDialog
        open={!!previewPayload}
        onOpenChange={(o) => !o && setPreviewPayload(null)}
        payload={previewPayload}
      />
    </div>
  );
}
