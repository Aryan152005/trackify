"use server";

import { createClient } from "@/lib/supabase/server";
import type { NotificationType } from "@/lib/types/notification";

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
// Notification Actions
// ---------------------------------------------------------------------------

export async function createNotification(data: {
  workspace_id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body?: string;
  entity_type?: string;
  entity_id?: string;
}) {
  const { supabase } = await getAuthenticatedUser();

  const { data: notification, error } = await supabase
    .from("notifications")
    .insert({
      workspace_id: data.workspace_id,
      user_id: data.user_id,
      type: data.type,
      title: data.title,
      body: data.body ?? null,
      entity_type: data.entity_type ?? null,
      entity_id: data.entity_id ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create notification: ${error.message}`);
  return notification;
}

export async function markAsRead(notificationId: string) {
  const { supabase } = await getAuthenticatedUser();

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId);

  if (error) throw new Error(`Failed to mark notification as read: ${error.message}`);
}

export async function markAllRead(workspaceId: string) {
  const { supabase, user } = await getAuthenticatedUser();

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .eq("is_read", false);

  if (error) throw new Error(`Failed to mark all notifications as read: ${error.message}`);
}

export async function deleteNotification(notificationId: string) {
  const { supabase } = await getAuthenticatedUser();

  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", notificationId);

  if (error) throw new Error(`Failed to delete notification: ${error.message}`);
}

export async function getUnreadCount(workspaceId: string) {
  const { supabase, user } = await getAuthenticatedUser();

  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .eq("is_read", false);

  if (error) throw new Error(`Failed to get unread count: ${error.message}`);
  return count ?? 0;
}
