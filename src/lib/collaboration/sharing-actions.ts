"use server";

import { createClient } from "@/lib/supabase/server";
import type { SharedLinkPermission } from "@/lib/types/collaboration";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error("Not authenticated");
  }
  return { supabase, user };
}

// ---------------------------------------------------------------------------
// Shared Link CRUD
// ---------------------------------------------------------------------------

export async function getSharedLinks(
  workspaceId: string,
  entityType: string,
  entityId: string
) {
  const { supabase } = await getAuthenticatedUser();

  const { data, error } = await supabase
    .from("shared_links")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch shared links: ${error.message}`);
  return data;
}

export async function createSharedLink(params: {
  workspaceId: string;
  entityType: string;
  entityId: string;
  permission: SharedLinkPermission;
  expiresAt?: string | null;
}) {
  const { supabase, user } = await getAuthenticatedUser();

  // Generate a random token
  const token =
    crypto.randomUUID().replace(/-/g, "") +
    crypto.randomUUID().replace(/-/g, "");

  const { data, error } = await supabase
    .from("shared_links")
    .insert({
      workspace_id: params.workspaceId,
      entity_type: params.entityType,
      entity_id: params.entityId,
      created_by: user.id,
      token,
      permission: params.permission,
      expires_at: params.expiresAt ?? null,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create shared link: ${error.message}`);
  return data;
}

export async function revokeSharedLink(linkId: string, workspaceId: string) {
  const { supabase, user } = await getAuthenticatedUser();

  // Only allow revoking links within the user's workspace and created by them
  const { error } = await supabase
    .from("shared_links")
    .update({ is_active: false })
    .eq("id", linkId)
    .eq("workspace_id", workspaceId)
    .eq("created_by", user.id);

  if (error) throw new Error(`Failed to revoke shared link: ${error.message}`);
}
