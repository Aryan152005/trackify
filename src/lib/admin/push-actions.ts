"use server";

import { requireAdmin } from "@/lib/admin/actions";
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
  /** "all" = every user with a push subscription. "selected" = only userIds. */
  target: "all" | "selected";
  userIds?: string[];
  title: string;
  body?: string;
  /** Deep-link into the app. Defaults to /notifications. */
  url?: string;
  /** Lets repeated broadcasts of the same kind replace the prior notification. */
  tag?: string;
}

export interface BroadcastResult {
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

  // Resolve recipients. Service-role client; target list comes from the
  // union of user_ids with at least one push subscription.
  const adminDb = createAdminClient();
  let candidateIds: string[] = [];
  if (input.target === "all") {
    const { data } = await adminDb.from("push_subscriptions").select("user_id");
    candidateIds = Array.from(new Set((data ?? []).map((s) => s.user_id as string)));
  } else {
    const ids = (input.userIds ?? []).filter((x) => typeof x === "string" && x.length > 0);
    if (ids.length === 0) throw new Error("Pick at least one user");
    const { data } = await adminDb
      .from("push_subscriptions")
      .select("user_id")
      .in("user_id", ids);
    candidateIds = Array.from(new Set((data ?? []).map((s) => s.user_id as string)));
  }

  const explicitRequested =
    input.target === "selected" ? (input.userIds ?? []).length : candidateIds.length;
  const skipped = Math.max(0, explicitRequested - candidateIds.length);

  if (candidateIds.length === 0) {
    await logEvent({
      service: "other",
      level: "warn",
      tag: "push.broadcast",
      message: "Admin broadcast had zero recipients with push enabled",
      metadata: { title, target: input.target, requested: explicitRequested, sent_by: admin.email },
    });
    return { targeted: 0, skipped, sent: 0, failed: 0, removed: 0 };
  }

  // Fan out with a small concurrency cap so a 200-user blast doesn't
  // open 200 simultaneous outbound TLS connections.
  const CONCURRENCY = 8;
  const results = { sent: 0, failed: 0, removed: 0 };
  let cursor = 0;

  async function worker() {
    while (cursor < candidateIds.length) {
      const i = cursor++;
      const uid = candidateIds[i];
      try {
        const r = await sendPushToUser(uid, payload);
        results.sent += r.sent;
        results.failed += r.failed;
        results.removed += r.removed;
      } catch {
        // Swallow — per-user failures are already logged by sendPushToUser.
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, candidateIds.length) }, () => worker()),
  );

  await logEvent({
    service: "other",
    level: results.sent > 0 ? "info" : "warn",
    tag: "push.broadcast",
    message: `Admin broadcast: "${title}" → ${results.sent} pushes to ${candidateIds.length} users`,
    metadata: {
      title,
      target: input.target,
      targeted_users: candidateIds.length,
      skipped_users: skipped,
      sent: results.sent,
      failed: results.failed,
      removed: results.removed,
      sent_by: admin.email,
    },
  });

  return {
    targeted: candidateIds.length,
    skipped,
    sent: results.sent,
    failed: results.failed,
    removed: results.removed,
  };
}
