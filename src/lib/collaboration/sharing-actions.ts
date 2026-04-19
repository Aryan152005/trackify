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

/**
 * Map a share entity_type to its DB table name. Kept private (not exported)
 * because this file carries "use server" — Next.js only allows async
 * function exports from server-action modules. The share API route keeps
 * its own copy (routes aren't "use server" and can export plain helpers).
 */
function tableForEntity(entityType: string): string | null {
  const map: Record<string, string> = {
    page: "pages",
    task: "tasks",
    board: "boards",
    entry: "work_entries",
    drawing: "drawings",
    mindmap: "mindmaps",
    challenge: "challenges",
  };
  return map[entityType] ?? null;
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

/**
 * List every active share link in the workspace — powers the workspace-level
 * audit view. Includes creator name for attribution + the entity title so the
 * admin can tell at a glance what's being shared. RLS on shared_links already
 * restricts visibility to workspace members; this action layers on a creator-
 * profile lookup since workspace_members.user_id FKs auth.users (see notes
 * elsewhere — postgrest can't embed user_profiles via that path).
 */
export interface SharedLinkAudit {
  id: string;
  workspace_id: string;
  entity_type: string;
  entity_id: string;
  permission: string;
  expires_at: string | null;
  created_at: string;
  token: string;
  created_by: string;
  creator_name: string;
  entity_title: string;
}

export async function getWorkspaceSharedLinks(
  workspaceId: string,
): Promise<SharedLinkAudit[]> {
  const { supabase } = await getAuthenticatedUser();

  const { data: links, error } = await supabase
    .from("shared_links")
    .select("id, workspace_id, entity_type, entity_id, permission, expires_at, created_at, token, created_by")
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to fetch share links: ${error.message}`);
  if (!links || links.length === 0) return [];

  // Resolve creator names in one round-trip.
  const creatorIds = Array.from(new Set(links.map((l) => l.created_by as string)));
  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("user_id, name")
    .in("user_id", creatorIds);
  const nameByUser = new Map<string, string>();
  (profiles ?? []).forEach((p) => {
    nameByUser.set(p.user_id as string, (p.name as string) ?? "Member");
  });

  // Resolve entity titles per-table. Kept deliberately simple — 7 tables
  // with small N of active links typically; fan out in parallel.
  const byTable = new Map<string, string[]>();
  for (const l of links) {
    const table = tableForEntity(l.entity_type as string);
    if (!table) continue;
    const list = byTable.get(table) ?? [];
    list.push(l.entity_id as string);
    byTable.set(table, list);
  }
  const titleByEntity = new Map<string, string>();
  await Promise.all(
    Array.from(byTable.entries()).map(async ([table, ids]) => {
      // Boards use `name`, every other table uses `title`.
      const titleCol = table === "boards" ? "name" : "title";
      const { data } = await supabase
        .from(table)
        .select(`id, ${titleCol}`)
        .in("id", ids);
      (data ?? []).forEach((row) => {
        const r = row as Record<string, unknown>;
        titleByEntity.set(
          `${table}:${r.id as string}`,
          (r[titleCol] as string) ?? "Untitled",
        );
      });
    }),
  );

  return links.map((l) => {
    const table = tableForEntity(l.entity_type as string);
    const titleKey = table ? `${table}:${l.entity_id as string}` : "";
    return {
      id: l.id as string,
      workspace_id: l.workspace_id as string,
      entity_type: l.entity_type as string,
      entity_id: l.entity_id as string,
      permission: l.permission as string,
      expires_at: (l.expires_at as string | null) ?? null,
      created_at: l.created_at as string,
      token: l.token as string,
      created_by: l.created_by as string,
      creator_name: nameByUser.get(l.created_by as string) ?? "Member",
      entity_title: titleByEntity.get(titleKey) ?? "Untitled",
    };
  });
}

export async function createSharedLink(params: {
  workspaceId: string;
  entityType: string;
  entityId: string;
  permission: SharedLinkPermission;
  expiresAt?: string | null;
}) {
  const { supabase, user } = await getAuthenticatedUser();

  // PRIVACY GATE — refuse to mint a share link for an entity the caller
  // has marked private. The viewer API bypasses RLS (service-role) to
  // support unauthenticated-ish public reads; without this check a caller
  // could generate a link to their own private note and hand it out,
  // defeating the whole is_private contract (migration 014).
  const table = tableForEntity(params.entityType);
  if (!table) throw new Error(`Unsupported entity type: ${params.entityType}`);

  // Note: 'challenges' may not have an is_private column (depending on how
  // the personal-spaces migration 014 applied) — we select defensively and
  // treat a missing column or false value as "public enough to share".
  const { data: entity, error: entityErr } = await supabase
    .from(table)
    .select("id, is_private")
    .eq("id", params.entityId)
    .maybeSingle();
  if (entityErr) {
    // If the caller can't even see the entity under RLS, refuse.
    throw new Error(`Entity not found or you don't have access`);
  }
  if (!entity) {
    throw new Error("Entity not found or you don't have access");
  }
  if ((entity as { is_private?: boolean }).is_private === true) {
    throw new Error(
      "This item is private — make it public before creating a share link.",
    );
  }

  // Generate a random token (256-bit — two UUIDs concatenated, hex).
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
  void user;

  // RLS on shared_links already enforces "creator OR workspace admin can
  // revoke" (migration 013). Previously we also hard-filtered by
  // created_by = auth.uid(), which meant a workspace admin couldn't clean
  // up a link left behind by a fired teammate. Dropping that filter lets
  // RLS govern and lets admins do cleanup.
  const { error } = await supabase
    .from("shared_links")
    .update({ is_active: false })
    .eq("id", linkId)
    .eq("workspace_id", workspaceId);

  if (error) throw new Error(`Failed to revoke shared link: ${error.message}`);
}
