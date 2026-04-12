import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { logEvent } from "@/lib/logs/logger";

let configured = false;

function configure() {
  if (configured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@trackify.app";
  if (!publicKey || !privateKey) {
    throw new Error("VAPID keys not configured (NEXT_PUBLIC_VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY)");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export interface PushPayload {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
  icon?: string;
}

/**
 * Send a push to all subscriptions for a given user. Returns counts.
 * Subscriptions that return 404/410 are deleted (device uninstalled / permission revoked).
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number; removed: number }> {
  configure();
  const admin = createAdminClient();

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", userId);

  if (!subs || subs.length === 0) return { sent: 0, failed: 0, removed: 0 };

  let sent = 0, failed = 0, removed = 0;
  const body = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint as string,
            keys: { p256dh: s.p256dh as string, auth: s.auth as string },
          },
          body
        );
        sent++;
        await admin
          .from("push_subscriptions")
          .update({ last_used_at: new Date().toISOString() })
          .eq("id", s.id);
      } catch (e) {
        const statusCode = (e as { statusCode?: number } | undefined)?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await admin.from("push_subscriptions").delete().eq("id", s.id);
          removed++;
        } else {
          failed++;
          await logEvent({
            service: "other",
            level: "warn",
            tag: "push.send",
            message: `Push delivery failed`,
            metadata: {
              userId,
              statusCode,
              error: e instanceof Error ? e.message : String(e),
            },
          });
        }
      }
    })
  );

  await logEvent({
    service: "other",
    level: sent > 0 || failed === 0 ? "info" : "warn",
    tag: "push.send",
    message: `Push sent to ${sent}/${subs.length} subscription(s)`,
    metadata: { userId, title: payload.title, sent, failed, removed },
    userId,
  });

  return { sent, failed, removed };
}
