"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
// Cursor / Presence Actions
// ---------------------------------------------------------------------------

export interface CursorData {
  x?: number;
  y?: number;
  block_id?: string;
  selection_start?: number;
  selection_end?: number;
  [key: string]: unknown;
}

export async function updateCursorPosition(
  workspaceId: string,
  entityType: string,
  entityId: string,
  cursorData: CursorData
) {
  const { supabase, user } = await getAuthenticatedUser();

  const { error } = await supabase.from("cursor_positions").upsert(
    {
      workspace_id: workspaceId,
      entity_type: entityType,
      entity_id: entityId,
      user_id: user.id,
      cursor_data: cursorData,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "user_id,entity_type,entity_id",
    }
  );

  if (error)
    throw new Error(`Failed to update cursor position: ${error.message}`);
}

export async function getCursorPositions(
  workspaceId: string,
  entityType: string,
  entityId: string
) {
  const { supabase, user } = await getAuthenticatedUser();

  // Only return cursors updated within the last 30 seconds
  const thirtySecondsAgo = new Date(
    Date.now() - 30 * 1000
  ).toISOString();

  const { data: cursors, error } = await supabase
    .from("cursor_positions")
    .select(
      `
      *,
      user_profiles!cursor_positions_user_id_fkey(name, avatar_url)
    `
    )
    .eq("workspace_id", workspaceId)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .neq("user_id", user.id)
    .gte("updated_at", thirtySecondsAgo);

  if (error)
    throw new Error(`Failed to fetch cursor positions: ${error.message}`);
  return cursors;
}

export async function cleanupStaleCursors() {
  // Use admin client since this may be called from a cron job
  const admin = createAdminClient();

  // Delete cursors older than 5 minutes
  const fiveMinutesAgo = new Date(
    Date.now() - 5 * 60 * 1000
  ).toISOString();

  const { error } = await admin
    .from("cursor_positions")
    .delete()
    .lt("updated_at", fiveMinutesAgo);

  if (error)
    throw new Error(`Failed to cleanup stale cursors: ${error.message}`);
}
