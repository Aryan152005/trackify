"use server";

import { createClient } from "@/lib/supabase/server";

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
// Mention Actions
// ---------------------------------------------------------------------------

export async function getMentions(workspaceId: string, userId: string) {
  const { supabase } = await getAuthenticatedUser();

  // FK `mentions.mentioned_by` points at auth.users, so we can't embed
  // user_profiles directly via PostgREST. Two-step lookup instead.
  const { data: mentions, error } = await supabase
    .from("mentions")
    .select(`*, comment:comments!mentions_comment_id_fkey(content, created_at)`)
    .eq("workspace_id", workspaceId)
    .eq("mentioned_user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch mentions: ${error.message}`);

  const mentionerIds = [...new Set((mentions ?? []).map((m) => m.mentioned_by as string))];
  const { data: profiles } = mentionerIds.length > 0
    ? await supabase.from("user_profiles").select("user_id, name, avatar_url").in("user_id", mentionerIds)
    : { data: [] as { user_id: string; name: string; avatar_url: string | null }[] };
  const pmap = new Map<string, { name: string; avatar_url: string | null }>();
  for (const p of profiles ?? []) {
    pmap.set(p.user_id as string, {
      name: (p.name as string) ?? "Someone",
      avatar_url: (p.avatar_url as string) ?? null,
    });
  }
  return (mentions ?? []).map((m) => ({
    ...m,
    mentioned_by_profile: pmap.get(m.mentioned_by as string) ?? null,
  }));
}

export async function getUnreadMentionCount(
  workspaceId: string,
  userId: string
) {
  const { supabase } = await getAuthenticatedUser();

  const { count, error } = await supabase
    .from("mentions")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("mentioned_user_id", userId)
    .eq("seen", false);

  if (error)
    throw new Error(`Failed to get unread mention count: ${error.message}`);
  return count ?? 0;
}

export async function markMentionSeen(mentionId: string) {
  const { supabase, user } = await getAuthenticatedUser();

  // Only allow the mentioned user to mark their own mention as seen
  const { error } = await supabase
    .from("mentions")
    .update({ seen: true })
    .eq("id", mentionId)
    .eq("mentioned_user_id", user.id);

  if (error) throw new Error(`Failed to mark mention as seen: ${error.message}`);
}

export async function markAllMentionsSeen(
  workspaceId: string,
  userId: string
) {
  const { supabase } = await getAuthenticatedUser();

  const { error } = await supabase
    .from("mentions")
    .update({ seen: true })
    .eq("workspace_id", workspaceId)
    .eq("mentioned_user_id", userId)
    .eq("seen", false);

  if (error)
    throw new Error(`Failed to mark all mentions as seen: ${error.message}`);
}

export async function searchUsers(workspaceId: string, query: string) {
  const { supabase } = await getAuthenticatedUser();

  // Two-step lookup because workspace_members.user_id → auth.users, not user_profiles,
  // so PostgREST embedding via FK hint fails with 400.
  const { data: members, error } = await supabase
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId);

  if (error) throw new Error(`Failed to search users: ${error.message}`);

  const userIds = (members ?? []).map((m) => m.user_id as string);
  if (userIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("user_id, name, avatar_url")
    .in("user_id", userIds)
    .ilike("name", `%${query}%`);

  return (profiles ?? []).map((p) => ({
    id: p.user_id as string,
    name: (p.name as string) ?? "",
    avatar_url: (p.avatar_url as string) ?? null,
  }));
}
