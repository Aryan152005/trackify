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

// ---------------------------------------------------------------------------
// Per-email grants (migration 036)
//
// A grant is "this email address has {view|editor} access via this specific
// share link". On first visit, an editor grant auto-promotes the grantee
// to a workspace editor via the share API route. View grants stay scoped
// to the read-only preview.
// ---------------------------------------------------------------------------

export type GrantPermission = "view" | "editor";

export interface ShareLinkGrant {
  id: string;
  shared_link_id: string;
  workspace_id: string;
  email: string;
  permission: GrantPermission;
  granted_by: string;
  granted_at: string;
  revoked_at: string | null;
  consumed_by_user_id: string | null;
  first_used_at: string | null;
}

export async function listLinkGrants(linkId: string): Promise<ShareLinkGrant[]> {
  const { supabase } = await getAuthenticatedUser();
  const { data, error } = await supabase
    .from("shared_link_grants")
    .select("*")
    .eq("shared_link_id", linkId)
    .is("revoked_at", null)
    .order("granted_at", { ascending: false });
  if (error) throw new Error(`Failed to list grants: ${error.message}`);
  return (data ?? []) as unknown as ShareLinkGrant[];
}

/**
 * Issue a grant on a share link. Rules:
 *   - link creator + workspace admins can grant any permission (view / editor).
 *   - an existing editor-grantee can grant ONLY view (downward delegation).
 *   - email is lowercased; (link, email) is unique — re-granting a previously
 *     revoked email just revives the row.
 * Side-effect: best-effort Resend email to the grantee so they discover the
 * access (no-op if RESEND_API_KEY or RESEND_FROM_EMAIL is unset).
 */
export async function addLinkGrant(params: {
  linkId: string;
  email: string;
  permission: GrantPermission;
}): Promise<ShareLinkGrant> {
  const { supabase, user } = await getAuthenticatedUser();

  const cleanEmail = params.email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    throw new Error("Enter a valid email address");
  }

  const { data: link, error: linkErr } = await supabase
    .from("shared_links")
    .select("id, workspace_id, entity_type, entity_id, token, created_by, is_active, permission")
    .eq("id", params.linkId)
    .maybeSingle();
  if (linkErr || !link) throw new Error("Share link not found or you don't have access");
  if (!link.is_active) throw new Error("This share link has been revoked");

  // Delegation guardrail (non-admin, non-creator callers must hold an
  // editor grant and can only issue view grants).
  const isCreator = (link.created_by as string) === user.id;
  let isAdmin = false;
  if (!isCreator) {
    const { data: me } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", link.workspace_id as string)
      .eq("user_id", user.id)
      .maybeSingle();
    isAdmin = !!me && (me.role === "admin" || me.role === "owner");
  }
  if (!isCreator && !isAdmin) {
    const callerEmail = user.email?.toLowerCase() ?? "";
    if (!callerEmail) throw new Error("Not allowed to grant — no email on your account");
    const { data: myGrant } = await supabase
      .from("shared_link_grants")
      .select("permission, revoked_at")
      .eq("shared_link_id", link.id as string)
      .eq("email", callerEmail)
      .maybeSingle();
    if (!myGrant || myGrant.revoked_at) {
      throw new Error("You don't have access to this shared link");
    }
    // Delegation rule: you can never issue a permission higher than your own.
    // View-grantees can onboard more view-grantees but cannot escalate;
    // editor-grantees can issue either level (but they're auto-joined to
    // the workspace on their first visit, so they'll normally use the
    // in-app share dialog instead of delegating via this path).
    if (params.permission === "editor" && myGrant.permission !== "editor") {
      throw new Error("You can only grant view access — editor grants require the link creator or a workspace admin");
    }
  }

  // Upsert — revives revoked rows.
  const { data: existing } = await supabase
    .from("shared_link_grants")
    .select("id")
    .eq("shared_link_id", link.id as string)
    .eq("email", cleanEmail)
    .maybeSingle();

  let row: Record<string, unknown> | null = null;
  if (existing) {
    const { data, error } = await supabase
      .from("shared_link_grants")
      .update({
        permission: params.permission,
        revoked_at: null,
        granted_by: user.id,
        granted_at: new Date().toISOString(),
      })
      .eq("id", existing.id as string)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(`Failed to update grant: ${error.message}`);
    row = data as Record<string, unknown> | null;
  } else {
    const { data, error } = await supabase
      .from("shared_link_grants")
      .insert({
        shared_link_id: link.id as string,
        workspace_id: link.workspace_id as string,
        email: cleanEmail,
        permission: params.permission,
        granted_by: user.id,
      })
      .select("*")
      .maybeSingle();
    if (error) throw new Error(`Failed to add grant: ${error.message}`);
    row = data as Record<string, unknown> | null;
  }
  if (!row) throw new Error("Grant was not created");

  // Best-effort email notification (no-op if Resend unset).
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const shareUrl = `${appUrl}/shared/${link.token as string}`;
    const { data: granterProfile } = await supabase
      .from("user_profiles")
      .select("name")
      .eq("user_id", user.id)
      .maybeSingle();
    const granterName = (granterProfile?.name as string | undefined) ?? user.email ?? "A teammate";
    const granterEmail = user.email ?? "";

    // Entity title — makes the email specific.
    const table = tableForEntity(link.entity_type as string);
    let entityTitle = "Untitled";
    if (table) {
      const titleCol = table === "boards" ? "name" : "title";
      const { data: ent } = await supabase
        .from(table)
        .select(`id, ${titleCol}`)
        .eq("id", link.entity_id as string)
        .maybeSingle();
      if (ent) {
        const e = ent as Record<string, unknown>;
        entityTitle = (e[titleCol] as string) ?? "Untitled";
      }
    }

    const resendKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    if (resendKey && from) {
      const { shareGrantEmail } = await import("@/lib/email/template");
      const tpl = shareGrantEmail({
        granteeEmail: cleanEmail,
        granterName,
        granterEmail,
        entityType: link.entity_type as string,
        entityTitle,
        permission: params.permission,
        shareUrl,
      });
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendKey}`,
          },
          body: JSON.stringify({ from, to: cleanEmail, subject: tpl.subject, html: tpl.html }),
        });
      } catch {
        /* email is optional */
      }
    }
  } catch {
    /* never block grant creation on email */
  }

  return row as unknown as ShareLinkGrant;
}

export async function revokeLinkGrant(grantId: string) {
  const { supabase } = await getAuthenticatedUser();
  const { error } = await supabase
    .from("shared_link_grants")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", grantId);
  if (error) throw new Error(`Failed to revoke grant: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Visit audit (migration 036)
// ---------------------------------------------------------------------------

export interface ShareLinkVisit {
  id: string;
  shared_link_id: string;
  workspace_id: string;
  visitor_user_id: string | null;
  visitor_email: string | null;
  outcome:
    | "view"
    | "auto-joined-workspace"
    | "denied-private"
    | "denied-expired"
    | "denied-revoked"
    | "denied-not-found";
  accessed_at: string;
}

export interface ShareLinkVisitSummary {
  total: number;
  unique_visitors: number;
  last_accessed_at: string | null;
  by_outcome: Record<string, number>;
  recent: ShareLinkVisit[];
}

/**
 * Return a summary of visits for a given share link. RLS on
 * shared_link_visits (migration 036) restricts SELECT to the link creator
 * and workspace admins — other callers will see zero rows rather than an
 * error.
 */
export async function getLinkVisitSummary(
  linkId: string,
): Promise<ShareLinkVisitSummary> {
  const { supabase } = await getAuthenticatedUser();

  const { data, error } = await supabase
    .from("shared_link_visits")
    .select("*")
    .eq("shared_link_id", linkId)
    .order("accessed_at", { ascending: false });
  if (error) throw new Error(`Failed to load visit log: ${error.message}`);

  const visits = (data ?? []) as unknown as ShareLinkVisit[];
  const uniq = new Set<string>();
  const byOutcome: Record<string, number> = {};
  for (const v of visits) {
    const key = v.visitor_user_id ?? v.visitor_email ?? "anon";
    uniq.add(key);
    byOutcome[v.outcome] = (byOutcome[v.outcome] ?? 0) + 1;
  }

  return {
    total: visits.length,
    unique_visitors: uniq.size,
    last_accessed_at: visits[0]?.accessed_at ?? null,
    by_outcome: byOutcome,
    recent: visits.slice(0, 20),
  };
}
