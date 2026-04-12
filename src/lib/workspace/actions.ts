"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { logEvent } from "@/lib/logs/logger";

export async function createWorkspace(name: string, description?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    + "-" + Date.now().toString(36);

  const { data: workspace, error } = await supabase
    .from("workspaces")
    .insert({
      name,
      slug,
      description: description || null,
      created_by: user.id,
      is_personal: false,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Add creator as owner
  await supabase.from("workspace_members").insert({
    workspace_id: workspace.id,
    user_id: user.id,
    role: "owner",
  });

  return workspace;
}

export async function createPersonalWorkspace(userId: string, name: string) {
  const admin = createAdminClient();

  const slug = "personal-" + userId;

  // Check if personal workspace already exists
  const { data: existing } = await admin
    .from("workspaces")
    .select("id")
    .eq("slug", slug)
    .single();

  if (existing) return existing;

  const { data: workspace, error } = await admin
    .from("workspaces")
    .insert({
      name: name + "'s Workspace",
      slug,
      created_by: userId,
      is_personal: true,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  await admin.from("workspace_members").insert({
    workspace_id: workspace.id,
    user_id: userId,
    role: "owner",
  });

  return workspace;
}

export async function inviteMember(
  workspaceId: string,
  email: string,
  role: "admin" | "editor" | "viewer" = "editor"
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("workspace_invitations")
    .insert({
      workspace_id: workspaceId,
      email: email.toLowerCase(),
      role,
      invited_by: user.id,
    })
    .select()
    .single();

  if (error) {
    await logEvent({
      service: "workspace",
      level: "error",
      tag: "invite.create",
      message: `Invite failed for ${email}: ${error.message}`,
      metadata: { workspaceId, email, role, code: error.code },
      userId: user.id,
      workspaceId,
    });
    throw new Error(error.message);
  }

  await logEvent({
    service: "workspace",
    level: "info",
    tag: "invite.create",
    message: `Invited ${email} as ${role}`,
    metadata: { invitationId: data.id, email, role },
    userId: user.id,
    workspaceId,
  });

  return data;
}

export async function acceptInvitation(token: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const admin = createAdminClient();

  // Find the invitation
  const { data: invitation, error: invError } = await admin
    .from("workspace_invitations")
    .select("*")
    .eq("token", token)
    .is("accepted_at", null)
    .single();

  if (invError || !invitation) {
    await logEvent({
      service: "workspace",
      level: "warn",
      tag: "invite.accept",
      message: `Invalid or expired invitation token`,
      metadata: { token: token.slice(0, 8) + "…", error: invError?.message },
      userId: user.id,
    });
    throw new Error("Invalid or expired invitation");
  }

  if (new Date(invitation.expires_at) < new Date()) {
    await logEvent({
      service: "workspace",
      level: "warn",
      tag: "invite.accept",
      message: `Expired invitation for ${invitation.email}`,
      metadata: { invitationId: invitation.id, expiresAt: invitation.expires_at },
      userId: user.id,
      workspaceId: invitation.workspace_id,
    });
    throw new Error("Invitation has expired");
  }

  if (invitation.email !== user.email?.toLowerCase()) {
    await logEvent({
      service: "workspace",
      level: "warn",
      tag: "invite.accept",
      message: `Invitation email mismatch`,
      metadata: { invitationId: invitation.id, expected: invitation.email, actual: user.email },
      userId: user.id,
      workspaceId: invitation.workspace_id,
    });
    throw new Error("This invitation was sent to a different email");
  }

  // Add user as member
  await admin.from("workspace_members").insert({
    workspace_id: invitation.workspace_id,
    user_id: user.id,
    role: invitation.role,
  });

  // Mark invitation as accepted
  await admin
    .from("workspace_invitations")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invitation.id);

  await logEvent({
    service: "workspace",
    level: "info",
    tag: "invite.accept",
    message: `Accepted invitation as ${invitation.role}`,
    metadata: { invitationId: invitation.id, role: invitation.role },
    userId: user.id,
    workspaceId: invitation.workspace_id,
  });

  redirect("/dashboard");
}

export async function updateMemberRole(
  memberId: string,
  role: "admin" | "editor" | "viewer"
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Defense-in-depth: verify the caller is an admin/owner in the same
  // workspace as the target member (RLS should also enforce this).
  const { data: target } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("id", memberId)
    .maybeSingle();
  if (!target) throw new Error("Member not found");
  if (target.role === "owner") throw new Error("Cannot change the owner's role");
  const { data: me } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", target.workspace_id as string)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!me || (me.role !== "owner" && me.role !== "admin")) {
    throw new Error("Only workspace admins can change member roles");
  }

  const { error } = await supabase
    .from("workspace_members")
    .update({ role })
    .eq("id", memberId);

  if (error) {
    await logEvent({
      service: "workspace",
      level: "error",
      tag: "member.updateRole",
      message: `Failed to update role: ${error.message}`,
      metadata: { memberId, role, code: error.code },
      userId: user?.id ?? null,
    });
    throw new Error(error.message);
  }

  await logEvent({
    service: "workspace",
    level: "info",
    tag: "member.updateRole",
    message: `Updated member role to ${role}`,
    metadata: { memberId, role },
    userId: user?.id ?? null,
  });
}

export async function removeMember(memberId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Defense-in-depth admin check.
  const { data: target } = await supabase
    .from("workspace_members")
    .select("workspace_id, role, user_id")
    .eq("id", memberId)
    .maybeSingle();
  if (!target) throw new Error("Member not found");
  if (target.role === "owner") throw new Error("Cannot remove the owner");

  // Allow a user to remove themselves (leave workspace) OR an admin/owner to remove someone else.
  if (target.user_id !== user.id) {
    const { data: me } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", target.workspace_id as string)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!me || (me.role !== "owner" && me.role !== "admin")) {
      throw new Error("Only workspace admins can remove members");
    }
  }

  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("id", memberId);

  if (error) {
    await logEvent({
      service: "workspace",
      level: "error",
      tag: "member.remove",
      message: `Failed to remove member: ${error.message}`,
      metadata: { memberId, code: error.code },
      userId: user?.id ?? null,
    });
    throw new Error(error.message);
  }

  await logEvent({
    service: "workspace",
    level: "info",
    tag: "member.remove",
    message: `Removed member`,
    metadata: { memberId },
    userId: user?.id ?? null,
  });
}

export async function updateWorkspace(
  workspaceId: string,
  data: { name?: string; description?: string }
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("workspaces")
    .update(data)
    .eq("id", workspaceId);

  if (error) throw new Error(error.message);
}

/**
 * Returns display name + email for a list of user IDs. Falls back to
 * auth.users.email (via admin client) when the user_profiles row is missing —
 * eliminates "Unknown" labels on the members page.
 */
export async function getMemberDisplayInfo(userIds: string[]): Promise<
  Record<string, { name: string; email: string; avatar_url: string | null }>
> {
  const unique = [...new Set(userIds.filter(Boolean))];
  const result: Record<string, { name: string; email: string; avatar_url: string | null }> = {};
  if (unique.length === 0) return result;

  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("user_id, name, avatar_url")
    .in("user_id", unique);

  for (const p of profiles ?? []) {
    result[p.user_id as string] = {
      name: (p.name as string) ?? "",
      email: "",
      avatar_url: (p.avatar_url as string) ?? null,
    };
  }

  // Fill in emails (always) and names for users without a profile, via admin.
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  for (const uid of unique) {
    try {
      const { data } = await admin.auth.admin.getUserById(uid);
      const email = data?.user?.email ?? "";
      const existing = result[uid];
      if (existing) {
        existing.email = email;
        if (!existing.name) existing.name = email.split("@")[0] || "Member";
      } else {
        result[uid] = {
          name: email.split("@")[0] || "Member",
          email,
          avatar_url: null,
        };
      }
    } catch {
      if (!result[uid]) {
        result[uid] = { name: "Member", email: "", avatar_url: null };
      }
    }
  }

  return result;
}

export async function getActiveWorkspaceId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Prefer the workspace the user actively selected (mirrored into a cookie
  // by WorkspaceProvider). Verify membership so a stale cookie can't leak data.
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  const cookieId = jar.get("wis_active_workspace")?.value;
  if (cookieId) {
    const { data: ok } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("workspace_id", cookieId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (ok?.workspace_id) return ok.workspace_id as string;
  }

  // Fallback: first-joined workspace.
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id, workspaces(is_personal)")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: true })
    .limit(1)
    .single();

  return membership?.workspace_id ?? null;
}
