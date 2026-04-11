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

  const { data: mentions, error } = await supabase
    .from("mentions")
    .select(
      `
      *,
      mentioned_by_profile:user_profiles!mentions_mentioned_by_fkey(name, avatar_url),
      comment:comments!mentions_comment_id_fkey(content, created_at)
    `
    )
    .eq("workspace_id", workspaceId)
    .eq("mentioned_user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch mentions: ${error.message}`);
  return mentions;
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

  // Find workspace members whose profile name matches the query
  const { data: members, error } = await supabase
    .from("workspace_members")
    .select(
      `
      user_id,
      user_profiles!workspace_members_user_id_fkey(name, avatar_url)
    `
    )
    .eq("workspace_id", workspaceId);

  if (error) throw new Error(`Failed to search users: ${error.message}`);

  // Filter by query on the client side since we need to match on the joined profile name
  const lowerQuery = query.toLowerCase();
  const results = (members ?? [])
    .filter((m: any) => {
      const name = m.user_profiles?.name;
      return name && name.toLowerCase().includes(lowerQuery);
    })
    .map((m: any) => ({
      id: m.user_id,
      name: m.user_profiles?.name ?? "",
      avatar_url: m.user_profiles?.avatar_url ?? null,
    }));

  return results;
}
