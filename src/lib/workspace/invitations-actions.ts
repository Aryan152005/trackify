"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logEvent } from "@/lib/logs/logger";
import { inviteEmail } from "@/lib/email/template";
import { randomUUID } from "crypto";
import type { RenderedEmail } from "@/lib/admin/preview-actions";

async function requireWorkspaceAdmin(workspaceId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: member } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member || (member.role !== "owner" && member.role !== "admin")) {
    throw new Error("Only owners and admins can manage invitations");
  }
  return { user, role: member.role as string };
}

export interface PendingInvitation {
  id: string;
  email: string;
  role: string;
  token: string;
  invited_by: string;
  inviter_name: string | null;
  expires_at: string;
  created_at: string;
}

export async function getPendingInvitations(workspaceId: string): Promise<PendingInvitation[]> {
  await requireWorkspaceAdmin(workspaceId);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("workspace_invitations")
    .select("id, email, role, token, invited_by, expires_at, created_at")
    .eq("workspace_id", workspaceId)
    .is("accepted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  // Resolve inviter names in one batch
  const inviterIds = Array.from(new Set(rows.map((r) => r.invited_by as string)));
  const { data: profiles } = await admin
    .from("user_profiles")
    .select("user_id, name")
    .in("user_id", inviterIds);
  const nameMap = new Map((profiles ?? []).map((p) => [p.user_id as string, p.name as string]));

  return rows.map((r) => ({
    id: r.id as string,
    email: r.email as string,
    role: r.role as string,
    token: r.token as string,
    invited_by: r.invited_by as string,
    inviter_name: nameMap.get(r.invited_by as string) ?? null,
    expires_at: r.expires_at as string,
    created_at: r.created_at as string,
  }));
}

export async function revokeInvitation(invitationId: string, workspaceId: string) {
  const { user } = await requireWorkspaceAdmin(workspaceId);
  const admin = createAdminClient();
  const { error } = await admin
    .from("workspace_invitations")
    .delete()
    .eq("id", invitationId)
    .eq("workspace_id", workspaceId);
  if (error) throw new Error(error.message);
  await logEvent({
    service: "workspace",
    level: "info",
    tag: "invite.revoke",
    message: `Invitation revoked`,
    metadata: { invitationId, workspaceId },
    userId: user.id,
    workspaceId,
  });
}

/** Generate a new token + extend expiry by 7 days. Returns the new token. */
export async function resendInvitation(invitationId: string, workspaceId: string): Promise<{ token: string }> {
  const { user } = await requireWorkspaceAdmin(workspaceId);
  const admin = createAdminClient();
  const newToken = randomUUID();
  const newExpiry = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  const { error } = await admin
    .from("workspace_invitations")
    .update({ token: newToken, expires_at: newExpiry })
    .eq("id", invitationId)
    .eq("workspace_id", workspaceId);
  if (error) throw new Error(error.message);
  await logEvent({
    service: "workspace",
    level: "info",
    tag: "invite.resend",
    message: `Invitation token regenerated`,
    metadata: { invitationId, workspaceId },
    userId: user.id,
    workspaceId,
  });
  return { token: newToken };
}

/** Render the invite email (subject + HTML) for copy-paste. */
export async function renderInviteEmailPayload(
  invitationId: string,
  workspaceId: string
): Promise<RenderedEmail> {
  await requireWorkspaceAdmin(workspaceId);
  const admin = createAdminClient();

  const { data: inv, error } = await admin
    .from("workspace_invitations")
    .select("email, token, invited_by, workspace_id, workspaces(name)")
    .eq("id", invitationId)
    .single();
  if (error || !inv) throw new Error("Invitation not found");

  // Inviter profile
  const { data: inviterProfile } = await admin
    .from("user_profiles")
    .select("name")
    .eq("user_id", inv.invited_by as string)
    .maybeSingle();

  // Invitee existing profile (to greet by name if we have it)
  const { data: inviteeProfile } = await admin
    .from("user_profiles")
    .select("name")
    .eq("user_id", "__placeholder__") // no user_id available; rely on workspace_invitations.email only
    .maybeSingle();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://trackify.vercel.app";
  const inviteUrl = `${appUrl}/api/workspace/invite/accept?token=${inv.token}`;
  const workspaceName = (inv.workspaces as unknown as { name: string } | null)?.name ?? "your workspace";
  const inviterName = inviterProfile?.name ?? "A teammate";
  const inviteeName = inviteeProfile?.name ?? "";

  const tpl = inviteEmail(inviteeName, inviterName, workspaceName, inviteUrl);
  return { to: inv.email as string, subject: tpl.subject, html: tpl.html };
}

/**
 * Bulk invite: creates multiple invitations at once, skipping duplicates.
 * Returns lists of created and skipped emails.
 */
export async function bulkInviteMembers(
  workspaceId: string,
  emails: string[],
  role: "admin" | "editor" | "viewer" = "editor"
): Promise<{
  created: { id: string; email: string }[];
  skipped: { email: string; reason: string }[];
}> {
  const { user } = await requireWorkspaceAdmin(workspaceId);
  const admin = createAdminClient();

  const normalized = Array.from(
    new Set(emails.map((e) => e.toLowerCase().trim()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))
  );

  const created: { id: string; email: string }[] = [];
  const skipped: { email: string; reason: string }[] = [];

  // Existing member emails (via auth.users lookup of workspace_members.user_id)
  const { data: existingMembers } = await admin
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId);
  const memberUserIds = new Set((existingMembers ?? []).map((m) => m.user_id as string));

  const { data: authList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const memberEmails = new Set<string>();
  (authList?.users ?? []).forEach((u) => {
    if (u.email && memberUserIds.has(u.id)) {
      memberEmails.add(u.email.toLowerCase());
    }
  });

  const { data: existingInvites } = await admin
    .from("workspace_invitations")
    .select("email")
    .eq("workspace_id", workspaceId)
    .is("accepted_at", null);
  const pendingEmails = new Set((existingInvites ?? []).map((i) => (i.email as string).toLowerCase()));

  for (const email of normalized) {
    if (memberEmails.has(email)) {
      skipped.push({ email, reason: "already a member" });
      continue;
    }
    if (pendingEmails.has(email)) {
      skipped.push({ email, reason: "already invited (pending)" });
      continue;
    }
    const { data: inserted, error } = await admin
      .from("workspace_invitations")
      .insert({ workspace_id: workspaceId, email, role, invited_by: user.id })
      .select("id")
      .single();
    if (error) {
      skipped.push({ email, reason: error.message });
      continue;
    }
    created.push({ id: inserted.id as string, email });
  }

  await logEvent({
    service: "workspace",
    level: "info",
    tag: "invite.bulk",
    message: `Bulk invite: ${created.length} created, ${skipped.length} skipped`,
    metadata: { created: created.length, skipped: skipped.length, role },
    userId: user.id,
    workspaceId,
  });

  return { created, skipped };
}
