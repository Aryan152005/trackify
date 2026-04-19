"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push/server";
import { logEvent } from "@/lib/logs/logger";
import { fetchProfileMap } from "./profile-helper";

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
    .select("user_id, role")
    .eq("workspace_id", workspaceId);
  if (error) return [];

  const others = (members ?? []).filter((m) => m.user_id !== user.id);
  const pmap = await fetchProfileMap(supabase, others.map((m) => m.user_id as string));
  return others.map((m) => ({
    user_id: m.user_id as string,
    name: pmap.get(m.user_id as string)?.name ?? "Unknown",
    avatar_url: pmap.get(m.user_id as string)?.avatar_url ?? null,
    role: m.role as string,
  }));
}

type EntityKind = "page" | "task" | "board" | "entry" | "drawing" | "mindmap" | "challenge";

const ENTITY_URL: Record<EntityKind, (id: string) => string> = {
  page: (id) => `/notes/${id}`,
  task: (id) => `/tasks/${id}`,
  board: (id) => `/boards/${id}`,
  entry: (id) => `/entries/${id}`,
  drawing: (id) => `/drawings/${id}`,
  mindmap: (id) => `/mindmaps/${id}`,
  challenge: (id) => `/challenges/${id}`,
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

  // Sender display — we show BOTH the profile name and the email so the
  // recipient has two ways to recognise who sent this (names can collide,
  // emails don't). Falls back gracefully if the profile row is missing.
  const { data: senderProfile } = await admin
    .from("user_profiles")
    .select("name")
    .eq("user_id", user.id)
    .maybeSingle();
  const senderName =
    (senderProfile?.name as string | undefined) ?? user.email?.split("@")[0] ?? "A teammate";
  const senderEmail = user.email ?? "";

  // Human-friendly label per entity kind — used in the notification copy so
  // "shared a drawing with you" reads naturally instead of "shared a page".
  const ENTITY_LABEL: Record<EntityKind, string> = {
    page: "note",
    task: "task",
    board: "board",
    entry: "work entry",
    drawing: "drawing",
    mindmap: "mind map",
    challenge: "challenge",
  };
  const label = ENTITY_LABEL[args.entityType];

  // Verb per action. The "view" / default case is what the ShareDialog's
  // "share with a teammate" flow sends — we treat that as an explicit share.
  const { title, body } = (() => {
    const msg = args.message?.trim();
    if (args.action === "comment") {
      return {
        title: `${senderName} wants your comment on a ${label}: "${args.entityTitle}"`,
        body: msg || `${senderEmail ? senderEmail + " · " : ""}Tap to open and comment.`,
      };
    }
    if (args.action === "edit") {
      return {
        title: `${senderName} wants you to edit a ${label}: "${args.entityTitle}"`,
        body: msg || `${senderEmail ? senderEmail + " · " : ""}Tap to open the editor.`,
      };
    }
    if (args.action === "join") {
      return {
        title: `${senderName} is waiting for you on a ${label}: "${args.entityTitle}"`,
        body: msg || `${senderEmail ? senderEmail + " · " : ""}Tap to join now.`,
      };
    }
    // Default / "view" — "share with teammate" path uses this.
    return {
      title: `${senderName} shared a ${label} with you: "${args.entityTitle}"`,
      body: msg || `${senderEmail ? senderEmail + " · " : ""}Tap to open.`,
    };
  })();

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
  } catch (e) {
    // Push is best-effort (recipient may have no subscribed devices) but log
    // so failures are traceable in /admin/logs.
    await logEvent({
      service: "other",
      level: "warn",
      tag: "nudge.pushFailed",
      message: e instanceof Error ? e.message : "Push failed",
      metadata: { toUserId: args.toUserId, entityType: args.entityType, entityId: args.entityId },
      userId: user.id,
      workspaceId: args.workspaceId,
    });
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
