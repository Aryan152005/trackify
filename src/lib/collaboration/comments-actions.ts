"use server";

import { createClient } from "@/lib/supabase/server";
import { fetchProfileMap } from "./profile-helper";

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

const MENTION_REGEX = /@\[([^\]]+)\]\(([^)]+)\)/g;

function parseMentions(content: string): { name: string; userId: string }[] {
  const mentions: { name: string; userId: string }[] = [];
  let match: RegExpExecArray | null;
  while ((match = MENTION_REGEX.exec(content)) !== null) {
    mentions.push({ name: match[1], userId: match[2] });
  }
  return mentions;
}

// ---------------------------------------------------------------------------
// Comment CRUD
// ---------------------------------------------------------------------------

export async function getComments(
  workspaceId: string,
  entityType: string,
  entityId: string
) {
  const { supabase } = await getAuthenticatedUser();

  const { data: comments, error } = await supabase
    .from("comments")
    .select(`*, replies:comments!parent_comment_id(count)`)
    .eq("workspace_id", workspaceId)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .is("parent_comment_id", null)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to fetch comments: ${error.message}`);
  const profileMap = await fetchProfileMap(supabase, (comments ?? []).map((c) => c.user_id as string));
  return (comments ?? []).map((c) => ({
    ...c,
    user_profiles: profileMap.get(c.user_id as string) ?? null,
  }));
}

export async function addComment(
  workspaceId: string,
  entityType: string,
  entityId: string,
  content: string,
  parentCommentId?: string
) {
  const { supabase, user } = await getAuthenticatedUser();

  const { data: comment, error } = await supabase
    .from("comments")
    .insert({
      workspace_id: workspaceId,
      entity_type: entityType,
      entity_id: entityId,
      user_id: user.id,
      content,
      parent_comment_id: parentCommentId ?? null,
    })
    .select("*")
    .single();

  if (error) throw new Error(`Failed to add comment: ${error.message}`);
  const profileMap = await fetchProfileMap(supabase, [comment.user_id as string]);
  (comment as Record<string, unknown>).user_profiles = profileMap.get(comment.user_id as string) ?? null;

  // Parse @mentions and create mention records + notifications
  const mentions = parseMentions(content);
  if (mentions.length > 0) {
    const mentionRecords = mentions.map((m) => ({
      workspace_id: workspaceId,
      comment_id: comment.id,
      entity_type: entityType,
      entity_id: entityId,
      mentioned_user_id: m.userId,
      mentioned_by: user.id,
    }));

    await supabase.from("mentions").insert(mentionRecords);

    // Create notifications for each mentioned user
    const notifications = mentions.map((m) => ({
      workspace_id: workspaceId,
      user_id: m.userId,
      type: "mention" as const,
      title: "You were mentioned in a comment",
      body: content.length > 100 ? content.substring(0, 100) + "..." : content,
      entity_type: entityType,
      entity_id: entityId,
      is_read: false,
    }));

    await supabase.from("notifications").insert(notifications);
  }

  return comment;
}

export async function updateComment(commentId: string, content: string) {
  const { supabase, user } = await getAuthenticatedUser();

  const { data: comment, error } = await supabase
    .from("comments")
    .update({ content, updated_at: new Date().toISOString() })
    .eq("id", commentId)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update comment: ${error.message}`);
  return comment;
}

export async function deleteComment(commentId: string) {
  const { supabase, user } = await getAuthenticatedUser();

  const { error } = await supabase
    .from("comments")
    .delete()
    .eq("id", commentId)
    .eq("user_id", user.id);

  if (error) throw new Error(`Failed to delete comment: ${error.message}`);
}

export async function resolveComment(commentId: string, workspaceId: string) {
  const { supabase, user } = await getAuthenticatedUser();

  // Verify the comment belongs to the specified workspace and the user
  // is either the comment author or a workspace member (editor+)
  const { data: existing, error: fetchError } = await supabase
    .from("comments")
    .select("id, user_id, workspace_id")
    .eq("id", commentId)
    .eq("workspace_id", workspaceId)
    .single();

  if (fetchError || !existing) {
    throw new Error("Comment not found in this workspace");
  }

  const { data: comment, error } = await supabase
    .from("comments")
    .update({ resolved: true, resolved_by: user.id })
    .eq("id", commentId)
    .eq("workspace_id", workspaceId)
    .select()
    .single();

  if (error) throw new Error(`Failed to resolve comment: ${error.message}`);
  return comment;
}

export async function getCommentCount(
  workspaceId: string,
  entityType: string,
  entityId: string
) {
  const { supabase } = await getAuthenticatedUser();

  const { count, error } = await supabase
    .from("comments")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId);

  if (error) throw new Error(`Failed to get comment count: ${error.message}`);
  return count ?? 0;
}
