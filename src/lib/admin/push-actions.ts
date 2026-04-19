"use server";

import { requireAdmin } from "@/lib/admin/actions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser, type PushPayload } from "@/lib/push/server";
import { logEvent } from "@/lib/logs/logger";

export interface PushRecipient {
  user_id: string;
  name: string;
  email: string | null;
  /** True if at least one active push subscription exists for this user. */
  has_push: boolean;
  last_active_at: string | null;
}

/**
 * Enumerate every user in the system alongside whether they have a push
 * subscription. Used by the admin composer to show "3 of 42 users will
 * actually receive this" + to grey-out names that won't deliver.
 *
 * Admin-only. Uses the service-role client to reach auth.users for email.
 */
export async function listPushRecipients(): Promise<PushRecipient[]> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: profiles } = await admin
    .from("user_profiles")
    .select("user_id, name, last_activity_at")
    .order("name", { ascending: true });
  if (!profiles) return [];

  // Batch lookup emails from auth.users.
  const { data: authData } = await admin.auth.admin.listUsers();
  const emailMap = new Map<string, string | null>();
  (authData?.users ?? []).forEach((u) => emailMap.set(u.id, u.email ?? null));

  // Set of user_ids with at least one push subscription.
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("user_id");
  const pushSet = new Set<string>((subs ?? []).map((s) => s.user_id as string));

  return profiles.map((p) => ({
    user_id: p.user_id as string,
    name: (p.name as string) ?? "Member",
    email: emailMap.get(p.user_id as string) ?? null,
    has_push: pushSet.has(p.user_id as string),
    last_active_at: (p.last_activity_at as string | null) ?? null,
  }));
}

export interface BroadcastInput {
  /**
   *  - "all" — every user who has ≥1 push subscription.
   *  - "selected" — only the given userIds (missing push → skipped).
   *  - "inactive_24h" — users whose last_activity_at is older than 24h
   *    (or NULL). Re-engagement push.
   */
  target: "all" | "selected" | "inactive_24h";
  userIds?: string[];
  title: string;
  body?: string;
  /** Deep-link into the app. Defaults to /notifications. */
  url?: string;
  /** Lets repeated broadcasts of the same kind replace the prior notification. */
  tag?: string;
}

export interface BroadcastResult {
  /** admin_broadcasts.id — for navigation back to reactions/comments. */
  broadcastId: string;
  /** Users we attempted to deliver to (had ≥1 subscription). */
  targeted: number;
  /** Users with no subscription; skipped. */
  skipped: number;
  /** Total individual subscriptions the push was delivered to successfully. */
  sent: number;
  /** Subscriptions that errored and were left in place (transient). */
  failed: number;
  /** Subscriptions deleted because the device/browser returned 404/410. */
  removed: number;
}

/**
 * Broadcast a push to many users in parallel. Fans out through the
 * per-user sendPushToUser (which already handles removal of dead
 * subscriptions + per-send logging). Logs one aggregate system_logs
 * row on completion so the admin can audit the blast from /admin/logs.
 *
 * Trims title + body to reasonable lengths so a fat paste doesn't blow
 * past the browser's notification limits (~100 chars title, ~200 body
 * before the UA truncates).
 */
export async function broadcastPush(input: BroadcastInput): Promise<BroadcastResult> {
  const admin = await requireAdmin();

  const title = input.title.trim().slice(0, 100);
  if (!title) throw new Error("Title is required");
  const body = (input.body ?? "").trim().slice(0, 300) || undefined;
  const url = (input.url ?? "").trim() || "/notifications";
  const tag = (input.tag ?? "").trim() || undefined;

  const payload: PushPayload = { title, body, url, tag, icon: "/icons/icon-192.png" };

  const adminDb = createAdminClient();

  // ── Resolve the full candidate user list for this target, BEFORE we
  // filter down to those with push subscriptions. That way in-app
  // notifications reach everyone (including users without push) while
  // the actual web-push fan-out only runs on deliverable ones.
  let allCandidateIds: string[] = [];
  if (input.target === "all") {
    const { data } = await adminDb.from("user_profiles").select("user_id");
    allCandidateIds = (data ?? []).map((r) => r.user_id as string);
  } else if (input.target === "inactive_24h") {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    // Inactive = last_activity_at before cutoff OR never set at all.
    const { data: stale } = await adminDb
      .from("user_profiles")
      .select("user_id")
      .lt("last_activity_at", cutoff);
    const { data: never } = await adminDb
      .from("user_profiles")
      .select("user_id")
      .is("last_activity_at", null);
    allCandidateIds = Array.from(
      new Set([
        ...((stale ?? []).map((r) => r.user_id as string)),
        ...((never ?? []).map((r) => r.user_id as string)),
      ]),
    );
  } else {
    // selected
    const ids = (input.userIds ?? []).filter((x) => typeof x === "string" && x.length > 0);
    if (ids.length === 0) throw new Error("Pick at least one user");
    allCandidateIds = Array.from(new Set(ids));
  }

  // Subset that actually has at least one push subscription — web-push
  // targets only these; users without push still get an in-app row.
  const { data: subs } = await adminDb
    .from("push_subscriptions")
    .select("user_id")
    .in("user_id", allCandidateIds.length === 0 ? ["00000000-0000-0000-0000-000000000000"] : allCandidateIds);
  const pushableIds = Array.from(new Set((subs ?? []).map((s) => s.user_id as string)));
  const skipped = Math.max(0, allCandidateIds.length - pushableIds.length);

  // ── Persist the broadcast record FIRST so we have an id for
  // notification rows to reference via entity_id.
  const { data: broadcastRow, error: bErr } = await adminDb
    .from("admin_broadcasts")
    .insert({
      sender_id: admin.id,
      sender_email: admin.email ?? "unknown",
      title,
      body,
      url,
      target: input.target,
      targeted_count: allCandidateIds.length,
      delivered_count: 0, // updated after fan-out
    })
    .select("id")
    .single();
  if (bErr || !broadcastRow) {
    throw new Error(`Failed to record broadcast: ${bErr?.message ?? "unknown"}`);
  }
  const broadcastId = broadcastRow.id as string;

  // ── In-app notifications — one per candidate user (whether they
  // have push or not). Admin broadcasts carry NULL workspace_id so
  // they're visible regardless of which workspace the user is in.
  if (allCandidateIds.length > 0) {
    const rows = allCandidateIds.map((uid) => ({
      workspace_id: null,
      user_id: uid,
      type: "broadcast",
      title,
      body: body ?? null,
      entity_type: "admin_broadcast",
      entity_id: broadcastId,
      is_read: false,
    }));
    // Chunk to avoid single-request size blowup on very large user bases.
    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      await adminDb.from("notifications").insert(rows.slice(i, i + CHUNK));
    }
  }

  // ── Web-push fan-out with concurrency cap so a 200-user blast doesn't
  // open 200 simultaneous outbound TLS connections.
  const results = { sent: 0, failed: 0, removed: 0 };
  if (pushableIds.length > 0) {
    const CONCURRENCY = 8;
    let cursor = 0;

    const broadcastUrl = `/notifications?broadcast=${broadcastId}`;
    const pushPayload: PushPayload = { ...payload, url: payload.url === "/notifications" ? broadcastUrl : payload.url };

    async function worker() {
      while (cursor < pushableIds.length) {
        const i = cursor++;
        const uid = pushableIds[i];
        try {
          const r = await sendPushToUser(uid, pushPayload);
          results.sent += r.sent;
          results.failed += r.failed;
          results.removed += r.removed;
        } catch {
          /* per-user failures already logged */
        }
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, pushableIds.length) }, () => worker()),
    );
  }

  // Update the delivered_count (for the admin history list).
  await adminDb
    .from("admin_broadcasts")
    .update({ delivered_count: results.sent })
    .eq("id", broadcastId);

  await logEvent({
    service: "other",
    level: results.sent > 0 || allCandidateIds.length > 0 ? "info" : "warn",
    tag: "push.broadcast",
    message: `Admin broadcast: "${title}" → ${results.sent} push, ${allCandidateIds.length} in-app`,
    metadata: {
      broadcast_id: broadcastId,
      title,
      target: input.target,
      targeted_users: allCandidateIds.length,
      pushable_users: pushableIds.length,
      skipped_users: skipped,
      sent: results.sent,
      failed: results.failed,
      removed: results.removed,
      sent_by: admin.email,
    },
  });

  return {
    broadcastId,
    targeted: allCandidateIds.length,
    skipped,
    sent: results.sent,
    failed: results.failed,
    removed: results.removed,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Reactions + comments — end-user engagement on a broadcast
// ═══════════════════════════════════════════════════════════════════════

export interface BroadcastReactionSummary {
  emoji: string;
  count: number;
  /** True if the current viewer is among the reactors. */
  me: boolean;
}

export interface BroadcastComment {
  id: string;
  user_id: string;
  author_name: string;
  body: string;
  created_at: string;
  /** Whether the current viewer can delete this comment (self or admin). */
  can_delete: boolean;
}

export interface BroadcastThread {
  id: string;
  title: string;
  body: string | null;
  url: string | null;
  sender_email: string;
  created_at: string;
  reactions: BroadcastReactionSummary[];
  comments: BroadcastComment[];
}

/**
 * Load a broadcast + its reactions (aggregated by emoji) + comments
 * (with author names resolved). Called from the notifications panel
 * when the user taps a broadcast row, and from the admin history view.
 */
export async function getBroadcastThread(
  broadcastId: string,
): Promise<BroadcastThread | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: b } = await supabase
    .from("admin_broadcasts")
    .select("id, title, body, url, sender_email, created_at")
    .eq("id", broadcastId)
    .maybeSingle();
  if (!b) return null;

  const [{ data: reactions }, { data: comments }] = await Promise.all([
    supabase
      .from("admin_broadcast_reactions")
      .select("emoji, user_id")
      .eq("broadcast_id", broadcastId),
    supabase
      .from("admin_broadcast_comments")
      .select("id, user_id, body, created_at")
      .eq("broadcast_id", broadcastId)
      .order("created_at", { ascending: true }),
  ]);

  // Reactions — group by emoji, mark if me.
  const byEmoji = new Map<string, { count: number; me: boolean }>();
  (reactions ?? []).forEach((r) => {
    const cur = byEmoji.get(r.emoji as string) ?? { count: 0, me: false };
    cur.count += 1;
    if ((r.user_id as string) === user.id) cur.me = true;
    byEmoji.set(r.emoji as string, cur);
  });
  const reactionSummary: BroadcastReactionSummary[] = Array.from(byEmoji.entries())
    .map(([emoji, v]) => ({ emoji, count: v.count, me: v.me }))
    .sort((a, b) => b.count - a.count);

  // Comments — resolve author names in one batch (auth.uid FK to
  // user_profiles.user_id).
  const uids = Array.from(new Set((comments ?? []).map((c) => c.user_id as string)));
  const adminDb = createAdminClient();
  const nameByUser = new Map<string, string>();
  if (uids.length > 0) {
    const { data: profiles } = await adminDb
      .from("user_profiles")
      .select("user_id, name")
      .in("user_id", uids);
    (profiles ?? []).forEach((p) => {
      nameByUser.set(p.user_id as string, (p.name as string) ?? "Member");
    });
  }

  // Admin-gate: is the caller the app admin? They can delete any
  // comment (moderation). Everyone else can delete only their own.
  const ADMIN_EMAIL = (process.env.ADMIN_EMAIL?.trim() || "paratakkearyan@gmail.com").toLowerCase();
  const isAdmin = (user.email ?? "").toLowerCase() === ADMIN_EMAIL;

  const commentList: BroadcastComment[] = (comments ?? []).map((c) => ({
    id: c.id as string,
    user_id: c.user_id as string,
    author_name: nameByUser.get(c.user_id as string) ?? "Member",
    body: c.body as string,
    created_at: c.created_at as string,
    can_delete: isAdmin || (c.user_id as string) === user.id,
  }));

  return {
    id: b.id as string,
    title: b.title as string,
    body: (b.body as string | null) ?? null,
    url: (b.url as string | null) ?? null,
    sender_email: b.sender_email as string,
    created_at: b.created_at as string,
    reactions: reactionSummary,
    comments: commentList,
  };
}

/**
 * Toggle a reaction on/off. If the user already reacted with this emoji,
 * the row is deleted; otherwise inserted.
 */
export async function toggleBroadcastReaction(
  broadcastId: string,
  emoji: string,
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const clean = emoji.trim().slice(0, 8);
  if (!clean) throw new Error("Empty emoji");

  const { data: existing } = await supabase
    .from("admin_broadcast_reactions")
    .select("id")
    .eq("broadcast_id", broadcastId)
    .eq("user_id", user.id)
    .eq("emoji", clean)
    .maybeSingle();

  if (existing) {
    await supabase.from("admin_broadcast_reactions").delete().eq("id", existing.id);
  } else {
    await supabase.from("admin_broadcast_reactions").insert({
      broadcast_id: broadcastId,
      user_id: user.id,
      emoji: clean,
    });
  }
}

/**
 * Add a comment on a broadcast. Length capped server-side (2000 chars)
 * to match the CHECK constraint.
 */
export async function addBroadcastComment(
  broadcastId: string,
  body: string,
): Promise<BroadcastComment> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const clean = body.trim().slice(0, 2000);
  if (!clean) throw new Error("Comment is empty");

  const { data, error } = await supabase
    .from("admin_broadcast_comments")
    .insert({
      broadcast_id: broadcastId,
      user_id: user.id,
      body: clean,
    })
    .select("id, user_id, body, created_at")
    .single();
  if (error || !data) throw new Error(`Failed to post comment: ${error?.message}`);

  // Resolve the commenter's display name for the optimistic UI.
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("name")
    .eq("user_id", user.id)
    .maybeSingle();

  return {
    id: data.id as string,
    user_id: data.user_id as string,
    author_name: (profile?.name as string | undefined) ?? user.email ?? "Member",
    body: data.body as string,
    created_at: data.created_at as string,
    can_delete: true,
  };
}

/**
 * Delete a comment. RLS permits self-delete; admins bypass via the
 * service-role client here after an explicit email check.
 */
export async function deleteBroadcastComment(commentId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const ADMIN_EMAIL = (process.env.ADMIN_EMAIL?.trim() || "paratakkearyan@gmail.com").toLowerCase();
  const isAdmin = (user.email ?? "").toLowerCase() === ADMIN_EMAIL;

  if (isAdmin) {
    const adminDb = createAdminClient();
    const { error } = await adminDb
      .from("admin_broadcast_comments")
      .delete()
      .eq("id", commentId);
    if (error) throw new Error(`Delete failed: ${error.message}`);
    return;
  }

  // Non-admin: RLS enforces self-only via user_id = auth.uid().
  const { error } = await supabase
    .from("admin_broadcast_comments")
    .delete()
    .eq("id", commentId);
  if (error) throw new Error(`Delete failed: ${error.message}`);
}

// ═══════════════════════════════════════════════════════════════════════
// Admin history — past broadcasts with engagement stats
// ═══════════════════════════════════════════════════════════════════════

export interface BroadcastHistoryRow {
  id: string;
  title: string;
  body: string | null;
  target: "all" | "selected" | "inactive_24h";
  sender_email: string;
  targeted_count: number;
  delivered_count: number;
  reaction_count: number;
  comment_count: number;
  created_at: string;
}

export async function listPastBroadcasts(limit = 20): Promise<BroadcastHistoryRow[]> {
  await requireAdmin();
  const adminDb = createAdminClient();
  const { data, error } = await adminDb
    .from("admin_broadcasts")
    .select("id, title, body, target, sender_email, targeted_count, delivered_count, reaction_count, comment_count, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Failed to load history: ${error.message}`);
  return (data ?? []) as unknown as BroadcastHistoryRow[];
}
