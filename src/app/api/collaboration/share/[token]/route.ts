import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Map entity types to their database table names
function getTableName(entityType: string): string | null {
  const tableMap: Record<string, string> = {
    page: "pages",
    board: "boards",
    task: "tasks",
    entry: "work_entries",
  };
  return tableMap[entityType] ?? null;
}

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

  // Fetch the entity data
  const { data: entity, error: entityError } = await admin
    .from(tableName)
    .select("*")
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
