"use client";

import { useEffect, useState } from "react";
import { useWorkspace, useRequireRole } from "@/lib/workspace/hooks";
import {
  inviteMember,
  updateMemberRole,
  removeMember,
} from "@/lib/workspace/actions";
import { createClient } from "@/lib/supabase/client";
import { AnimatedPage, AnimatedList, AnimatedItem } from "@/components/ui/animated-layout";
import Link from "next/link";
import { ArrowLeft, UserPlus, Shield, Trash2 } from "lucide-react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import type { WorkspaceRole } from "@/lib/types/workspace";

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
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer" | "admin">("editor");
  const [inviting, setInviting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!workspace) return;
    loadMembers();
  }, [workspace]);

  async function loadMembers() {
    if (!workspace) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("workspace_members")
      .select("id, user_id, role, joined_at, user_profiles(name, avatar_url)")
      .eq("workspace_id", workspace.id)
      .order("joined_at", { ascending: true });

    if (data) {
      setMembers(
        data.map((m) => ({
          id: m.id,
          user_id: m.user_id,
          role: m.role as WorkspaceRole,
          joined_at: m.joined_at,
          name: (m.user_profiles as unknown as { name: string })?.name || "Unknown",
          avatar_url: (m.user_profiles as unknown as { avatar_url: string | null })?.avatar_url || null,
        }))
      );
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!workspace || !inviteEmail.trim()) return;
    setInviting(true);
    setMessage("");
    try {
      const inv = await inviteMember(workspace.id, inviteEmail.trim(), inviteRole);
      setMessage(`Invitation sent! Token: ${inv.token}`);
      setInviteEmail("");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to invite");
    }
    setInviting(false);
  }

  async function handleRoleChange(memberId: string, role: "admin" | "editor" | "viewer") {
    try {
      await updateMemberRole(memberId, role);
      loadMembers();
    } catch {
      // handle error
    }
  }

  async function handleRemove(memberId: string) {
    if (!confirm("Remove this member?")) return;
    try {
      await removeMember(memberId);
      loadMembers();
    } catch {
      // handle error
    }
  }

  if (!workspace) return null;

  const roleColors: Record<WorkspaceRole, string> = {
    owner: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    admin: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    editor: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    viewer: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300",
  };

  return (
    <AnimatedPage>
      <div className="mb-6">
        <Link
          href="/workspace"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Settings
        </Link>
      </div>

      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Members
        </h1>
        <span className="text-sm text-zinc-500">{members.length} members</span>
      </div>

      {isAdmin && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 mb-6">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-3 flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> Invite Member
          </h2>
          <form onSubmit={handleInvite} className="flex flex-wrap gap-3">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="email@example.com"
              className="flex-1 min-w-[200px] rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
            />
            <Select
              value={inviteRole}
              onValueChange={(v) => setInviteRole(v as "admin" | "editor" | "viewer")}
            >
              <SelectTrigger className="w-auto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">Viewer</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <button
              type="submit"
              disabled={inviting}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {inviting ? "Sending..." : "Invite"}
            </button>
          </form>
          {message && (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{message}</p>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <AnimatedList>
          {members.map((member) => (
            <AnimatedItem key={member.id}>
              <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 last:border-b-0 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-200 text-sm font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {member.name}
                    </div>
                    <div className="text-xs text-zinc-500">
                      Joined {new Date(member.joined_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isAdmin && member.role !== "owner" ? (
                    <>
                      <Select
                        value={member.role}
                        onValueChange={(v) =>
                          handleRoleChange(
                            member.id,
                            v as "admin" | "editor" | "viewer"
                          )
                        }
                      >
                        <SelectTrigger className="w-auto">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="viewer">Viewer</SelectItem>
                          <SelectItem value="editor">Editor</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <button
                        onClick={() => handleRemove(member.id)}
                        className="rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${roleColors[member.role]}`}
                    >
                      <Shield className="h-3 w-3" />
                      {member.role}
                    </span>
                  )}
                </div>
              </div>
            </AnimatedItem>
          ))}
        </AnimatedList>
      </div>
    </AnimatedPage>
  );
}
