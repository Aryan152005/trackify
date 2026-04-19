import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Map entity types to their database table names.
function getTableName(entityType: string): string | null {
  const tableMap: Record<string, string> = {
    page: "pages",
    board: "boards",
    task: "tasks",
    entry: "work_entries",
    drawing: "drawings",
    mindmap: "mindmaps",
    challenge: "challenges",
  };
  return tableMap[entityType] ?? null;
}

/**
 * Per-entity-type column allowlist. The viewer UI at /shared/[token] only
 * renders a curated handful of fields — returning everything from select("*")
 * leaks columns the reader never asked to see (e.g. productivity_score,
 * mood, work_done, learning, next_day_plan on a shared entry).
 *
 * Each branch picks exactly what the read-only preview renders. `is_private`
 * is fetched separately for the privacy gate but not returned to the client.
 */
const PUBLIC_FIELDS: Record<string, string[]> = {
  page: ["id", "title", "icon", "content"],
  task: ["id", "title", "description", "status", "priority", "due_date"],
  board: ["id", "name", "description"],
  entry: ["id", "title", "description", "date", "hours_worked"],
  drawing: ["id", "title", "thumbnail_url"],
  mindmap: ["id", "title", "description"],
  challenge: ["id", "title", "description", "duration_days", "mode", "days"],
};

/**
 * Log a visit to shared_link_visits. Service-role insert (RLS bypassed)
 * because the visitor isn't necessarily a workspace member and we want
 * every hit on the record regardless. Non-blocking — errors swallowed.
 */
async function logVisit(
  admin: ReturnType<typeof createAdminClient>,
  params: {
    linkId: string;
    workspaceId: string;
    visitorUserId: string | null;
    visitorEmail: string | null;
    outcome:
      | "view"
      | "auto-joined-workspace"
      | "denied-private"
      | "denied-expired"
      | "denied-revoked"
      | "denied-not-found";
  },
) {
  try {
    await admin.from("shared_link_visits").insert({
      shared_link_id: params.linkId,
      workspace_id: params.workspaceId,
      visitor_user_id: params.visitorUserId,
      visitor_email: params.visitorEmail,
      outcome: params.outcome,
    });
  } catch {
    /* visit log is best-effort — never block the response */
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!token) {
    return NextResponse.json({ error: "Token is required" }, { status: 400 });
  }

  // Resolve the current viewer (if any) via the server client. We still use
  // the admin client for reads that bypass RLS (entity, grants), but the
  // viewer identity needs cookies.
  const userClient = await createClient();
  const {
    data: { user: viewer },
  } = await userClient.auth.getUser();
  const viewerId = viewer?.id ?? null;
  const viewerEmail = viewer?.email?.toLowerCase() ?? null;

  const admin = createAdminClient();

  // Find the share link (regardless of is_active so we can log denied-revoked).
  const { data: link } = await admin
    .from("shared_links")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (!link) {
    // Nothing to log against since we don't know the link id.
    return NextResponse.json({ error: "Shared link not found" }, { status: 404 });
  }

  if (!link.is_active) {
    await logVisit(admin, {
      linkId: link.id as string,
      workspaceId: link.workspace_id as string,
      visitorUserId: viewerId,
      visitorEmail: viewerEmail,
      outcome: "denied-revoked",
    });
    return NextResponse.json({ error: "Shared link not found" }, { status: 404 });
  }

  if (link.expires_at && new Date(link.expires_at as string) < new Date()) {
    await logVisit(admin, {
      linkId: link.id as string,
      workspaceId: link.workspace_id as string,
      visitorUserId: viewerId,
      visitorEmail: viewerEmail,
      outcome: "denied-expired",
    });
    return NextResponse.json(
      { error: "This shared link has expired" },
      { status: 410 },
    );
  }

  const tableName = getTableName(link.entity_type as string);
  if (!tableName) {
    return NextResponse.json({ error: "Unknown entity type" }, { status: 400 });
  }

  // Privacy gate — defense-in-depth against a link minted before the item
  // was made private.
  const { data: privacyCheck } = await admin
    .from(tableName)
    .select("id, is_private")
    .eq("id", link.entity_id as string)
    .maybeSingle();
  if (!privacyCheck) {
    await logVisit(admin, {
      linkId: link.id as string,
      workspaceId: link.workspace_id as string,
      visitorUserId: viewerId,
      visitorEmail: viewerEmail,
      outcome: "denied-not-found",
    });
    return NextResponse.json({ error: "Entity not found" }, { status: 404 });
  }
  if ((privacyCheck as { is_private?: boolean }).is_private === true) {
    await logVisit(admin, {
      linkId: link.id as string,
      workspaceId: link.workspace_id as string,
      visitorUserId: viewerId,
      visitorEmail: viewerEmail,
      outcome: "denied-private",
    });
    return NextResponse.json({ error: "Shared link not found" }, { status: 404 });
  }

  // Look up a matching active grant for the viewer's email. An editor
  // grant auto-joins the workspace; a view grant just stamps the visit.
  let viewerGrant:
    | { id: string; permission: "view" | "editor" }
    | null = null;
  let autoJoined = false;
  if (viewerEmail) {
    const { data: grant } = await admin
      .from("shared_link_grants")
      .select("id, permission, revoked_at, consumed_by_user_id, first_used_at")
      .eq("shared_link_id", link.id as string)
      .eq("email", viewerEmail)
      .is("revoked_at", null)
      .maybeSingle();
    if (grant) {
      viewerGrant = {
        id: grant.id as string,
        permission: grant.permission as "view" | "editor",
      };
      // Stamp consumed_by on first use so the grant list shows "used".
      if (!grant.first_used_at) {
        await admin
          .from("shared_link_grants")
          .update({
            consumed_by_user_id: viewerId,
            first_used_at: new Date().toISOString(),
          })
          .eq("id", grant.id as string);
      }

      // Editor grant: ensure workspace membership so RLS lets them into the
      // full in-app editor. We upsert into workspace_members with role=editor
      // only when they're not already a member (don't downgrade an owner).
      if (viewerGrant.permission === "editor" && viewerId) {
        const { data: existingMember } = await admin
          .from("workspace_members")
          .select("role")
          .eq("workspace_id", link.workspace_id as string)
          .eq("user_id", viewerId)
          .maybeSingle();
        if (!existingMember) {
          const { error: joinErr } = await admin
            .from("workspace_members")
            .insert({
              workspace_id: link.workspace_id as string,
              user_id: viewerId,
              role: "editor",
            });
          if (!joinErr) autoJoined = true;
        }
      }
    }
  }

  // Field-filtered entity fetch.
  const allowlist = PUBLIC_FIELDS[link.entity_type as keyof typeof PUBLIC_FIELDS];
  if (!allowlist) {
    return NextResponse.json(
      { error: "Unsupported entity type" },
      { status: 400 },
    );
  }
  const { data: entity, error: entityError } = await admin
    .from(tableName)
    .select(allowlist.join(", "))
    .eq("id", link.entity_id as string)
    .single();
  if (entityError || !entity) {
    return NextResponse.json({ error: "Entity not found" }, { status: 404 });
  }

  // Resolve workspace name for the "Shared by {workspace}" banner.
  let workspaceName: string | undefined;
  if (link.workspace_id) {
    const { data: ws } = await admin
      .from("workspaces")
      .select("name")
      .eq("id", link.workspace_id as string)
      .maybeSingle();
    workspaceName = (ws?.name as string | undefined) ?? undefined;
  }

  await logVisit(admin, {
    linkId: link.id as string,
    workspaceId: link.workspace_id as string,
    visitorUserId: viewerId,
    visitorEmail: viewerEmail,
    outcome: autoJoined ? "auto-joined-workspace" : "view",
  });

  return NextResponse.json({
    entity,
    entityType: link.entity_type,
    permission: link.permission,
    workspaceName,
    workspaceId: link.workspace_id,
    linkId: link.id,
    viewerGrant,
    autoJoined,
  });
}
