import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Map entity types to their database table names
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!token) {
    return NextResponse.json(
      { error: "Token is required" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Find the share link
  const { data: link, error: linkError } = await admin
    .from("shared_links")
    .select("*")
    .eq("token", token)
    .eq("is_active", true)
    .single();

  if (linkError || !link) {
    return NextResponse.json(
      { error: "Shared link not found" },
      { status: 404 }
    );
  }

  // Check expiry
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return NextResponse.json(
      { error: "This shared link has expired" },
      { status: 410 }
    );
  }

  // Resolve entity table
  const tableName = getTableName(link.entity_type);
  if (!tableName) {
    return NextResponse.json(
      { error: "Unknown entity type" },
      { status: 400 }
    );
  }

  // Privacy gate — defense-in-depth. Even if a link was created before
  // the item was turned private (so createSharedLink's check didn't fire),
  // we refuse to serve a private entity from this public endpoint.
  const privacyFields = "id, is_private";
  const { data: privacyCheck } = await admin
    .from(tableName)
    .select(privacyFields)
    .eq("id", link.entity_id)
    .maybeSingle();
  if (!privacyCheck) {
    return NextResponse.json(
      { error: "Entity not found" },
      { status: 404 }
    );
  }
  if ((privacyCheck as { is_private?: boolean }).is_private === true) {
    // Treat as 404 rather than 403 — don't advertise the item's existence.
    return NextResponse.json(
      { error: "Shared link not found" },
      { status: 404 }
    );
  }

  // Field-filtered fetch — only the columns the read-only preview renders.
  const allowlist = PUBLIC_FIELDS[link.entity_type as keyof typeof PUBLIC_FIELDS];
  if (!allowlist) {
    return NextResponse.json(
      { error: "Unsupported entity type" },
      { status: 400 }
    );
  }
  const { data: entity, error: entityError } = await admin
    .from(tableName)
    .select(allowlist.join(", "))
    .eq("id", link.entity_id)
    .single();

  if (entityError || !entity) {
    return NextResponse.json(
      { error: "Entity not found" },
      { status: 404 }
    );
  }

  // Resolve workspace name for the "Shared by {workspace}" banner
  let workspaceName: string | undefined;
  if (link.workspace_id) {
    const { data: ws } = await admin
      .from("workspaces")
      .select("name")
      .eq("id", link.workspace_id)
      .maybeSingle();
    workspaceName = (ws?.name as string | undefined) ?? undefined;
  }

  // Return camelCase keys — the /shared/[token] page reads entityType, permission.
  return NextResponse.json({
    entity,
    entityType: link.entity_type,
    permission: link.permission,
    workspaceName,
    workspaceId: link.workspace_id,
  });
}
