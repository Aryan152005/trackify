"use server";

import { createClient } from "@/lib/supabase/server";

export type ActivityAction = "created" | "edited" | "renamed" | "deleted" | "archived" | "invited" | "joined";

export async function logActivity(args: {
  workspaceId: string | null;
  action: ActivityAction;
  entityType: string;
  entityId: string;
  entityTitle: string;
  metadata?: Record<string, unknown>;
}) {
  if (!args.workspaceId) return;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("activity_log").insert({
      workspace_id: args.workspaceId,
      user_id: user.id,
      action: args.action,
      entity_type: args.entityType,
      entity_id: args.entityId,
      entity_title: args.entityTitle,
      metadata: args.metadata ?? {},
    });
  } catch {
    // swallow — activity logging must never break the mutation
  }
}

export interface ActivityRow {
  id: string;
  workspace_id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  entity_title: string;
  metadata: Record<string, unknown>;
  created_at: string;
  actor_name: string;
  actor_avatar: string | null;
}

export async function listWorkspaceActivity(workspaceId: string, limit = 100): Promise<ActivityRow[]> {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("activity_log")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!rows || rows.length === 0) return [];

  const userIds = [...new Set(rows.map((r) => r.user_id as string))];
  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("user_id, name, avatar_url")
    .in("user_id", userIds);

  const pmap = new Map<string, { name: string; avatar_url: string | null }>();
  for (const p of profiles ?? []) {
    pmap.set(p.user_id as string, {
      name: (p.name as string) ?? "Unknown",
      avatar_url: (p.avatar_url as string) ?? null,
    });
  }

  return rows.map((r) => ({
    id: r.id as string,
    workspace_id: r.workspace_id as string,
    user_id: r.user_id as string,
    action: r.action as string,
    entity_type: r.entity_type as string,
    entity_id: r.entity_id as string,
    entity_title: (r.entity_title as string) ?? "Untitled",
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    created_at: r.created_at as string,
    actor_name: pmap.get(r.user_id as string)?.name ?? "Someone",
    actor_avatar: pmap.get(r.user_id as string)?.avatar_url ?? null,
  }));
}

export async function getWorkspaceMemberStats(workspaceId: string) {
  const supabase = await createClient();
  const { data: members } = await supabase
    .from("workspace_members")
    .select("user_id, role, joined_at")
    .eq("workspace_id", workspaceId);

  const userIds = (members ?? []).map((m) => m.user_id as string);
  const pmap = new Map<string, { name: string; avatar_url: string | null }>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("user_id, name, avatar_url")
      .in("user_id", userIds);
    for (const p of profiles ?? []) {
      pmap.set(p.user_id as string, {
        name: (p.name as string) ?? "Unknown",
        avatar_url: (p.avatar_url as string) ?? null,
      });
    }
  }

  // Per-user activity count (last 30 days)
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const { data: acts } = await supabase
    .from("activity_log")
    .select("user_id, action")
    .eq("workspace_id", workspaceId)
    .gte("created_at", since);

  const counts = new Map<string, number>();
  for (const a of acts ?? []) {
    const k = a.user_id as string;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  return (members ?? []).map((m) => {
    const profile = pmap.get(m.user_id as string);
    return {
      user_id: m.user_id as string,
      name: profile?.name ?? "Unknown",
      avatar_url: profile?.avatar_url ?? null,
      role: m.role as string,
      joined_at: m.joined_at as string,
      activity_30d: counts.get(m.user_id as string) ?? 0,
    };
  });
}
