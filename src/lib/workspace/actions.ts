"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

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

  if (error) throw new Error(error.message);
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

  if (invError || !invitation) throw new Error("Invalid or expired invitation");

  if (new Date(invitation.expires_at) < new Date()) {
    throw new Error("Invitation has expired");
  }

  if (invitation.email !== user.email?.toLowerCase()) {
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

  redirect("/dashboard");
}

export async function updateMemberRole(
  memberId: string,
  role: "admin" | "editor" | "viewer"
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("workspace_members")
    .update({ role })
    .eq("id", memberId);

  if (error) throw new Error(error.message);
}

export async function removeMember(memberId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("id", memberId);

  if (error) throw new Error(error.message);
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

export async function getActiveWorkspaceId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // For server components, we get the first workspace the user is a member of
  // The client-side context handles the active workspace selection
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id, workspaces(is_personal)")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: true })
    .limit(1)
    .single();

  return membership?.workspace_id ?? null;
}
