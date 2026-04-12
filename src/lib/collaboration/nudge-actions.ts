"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push/server";
import { logEvent } from "@/lib/logs/logger";

interface Member {
  user_id: string;
  name: string;
  avatar_url: string | null;
  role: string;
}

/**
 * List all other members in the given workspace (excludes the caller).
 * Used to populate the "nudge" / "call" teammate picker.
 */
export async function listWorkspaceTeammates(workspaceId: string): Promise<Member[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: members, error } = await supabase
    .from("workspace_members")
    .select("user_id, role, user_profiles(name, avatar_url)")
    .eq("workspace_id", workspaceId);
  if (error) return [];

  return (members ?? [])
    .filter((m) => m.user_id !== user.id)
    .map((m) => {
      const p = m.user_profiles as unknown as { name: string | null; avatar_url: string | null } | null;
      return {
        user_id: m.user_id as string,
        name: p?.name ?? "Unknown",
        avatar_url: p?.avatar_url ?? null,
        role: m.role as string,
      };
    });
}

type EntityKind = "page" | "task" | "board" | "entry" | "drawing" | "mindmap";

const ENTITY_URL: Record<EntityKind, (id: string) => string> = {
  page: (id) => `/notes/${id}`,
  task: (id) => `/tasks/${id}`,
  board: (id) => `/boards/${id}`,
  entry: () => `/entries`,
  drawing: (id) => `/drawings/${id}`,
  mindmap: (id) => `/mindmaps/${id}`,
};

/**
 * Nudge (call) a teammate — creates an in-app notification AND fires a push
 * to all of their subscribed devices. The recipient receives a clickable
 * notification that opens the entity directly.
 */
export async function nudgeTeammate(args: {
  toUserId: string;
  workspaceId: string;
  entityType: EntityKind;
  entityId: string;
  entityTitle: string;
  message?: string;
  action?: "view" | "comment" | "edit" | "join";
}): Promise<{ notificationId: string; pushSent: number }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Verify sender + recipient share the workspace
  const { data: senderMembership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", args.workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!senderMembership) throw new Error("You don't belong to this workspace");

  const admin = createAdminClient();
  const { data: recipientMembership } = await admin
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", args.workspaceId)
    .eq("user_id", args.toUserId)
    .maybeSingle();
  if (!recipientMembership) throw new Error("Recipient isn't in this workspace");

  // Sender name
  const { data: senderProfile } = await admin
    .from("user_profiles")
    .select("name")
    .eq("user_id", user.id)
    .maybeSingle();
  const senderName = (senderProfile?.name as string | undefined) ?? user.email?.split("@")[0] ?? "A teammate";

  const verb = args.action === "comment" ? "wants your comment on"
    : args.action === "edit" ? "wants you to edit"
    : args.action === "join" ? "is waiting for you on"
    : "pinged you on";

  const title = `${senderName} ${verb} "${args.entityTitle}"`;
  const body = args.message?.trim() || "Tap to join them now.";
  const url = ENTITY_URL[args.entityType](args.entityId);

  // 1. Insert in-app notification (visible via NotificationBell)
  const { data: notif, error: insertError } = await admin
    .from("notifications")
    .insert({
      workspace_id: args.workspaceId,
      user_id: args.toUserId,
      type: "nudge",
      title,
      body,
      entity_type: args.entityType,
      entity_id: args.entityId,
    })
    .select("id")
    .single();
  if (insertError) throw new Error(`Failed to notify: ${insertError.message}`);

  // 2. Fire push (best-effort — notification still lands even if push fails)
  let pushSent = 0;
  try {
    const res = await sendPushToUser(args.toUserId, {
      title,
      body,
      url,
      tag: `nudge-${args.entityType}-${args.entityId}`,
    });
    pushSent = res.sent;
  } catch {
    /* swallow — in-app notif already created */
  }

  await logEvent({
    service: "workspace",
    level: "info",
    tag: "nudge.send",
    message: `${senderName} nudged someone on ${args.entityType} "${args.entityTitle}"`,
    metadata: {
      fromUserId: user.id,
      toUserId: args.toUserId,
      entityType: args.entityType,
      entityId: args.entityId,
      pushSent,
    },
    userId: user.id,
    workspaceId: args.workspaceId,
  });

  return { notificationId: notif.id as string, pushSent };
}
