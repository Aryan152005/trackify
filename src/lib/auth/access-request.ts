import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push/server";
import { logEvent } from "@/lib/logs/logger";

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? "paratakkearyan@gmail.com").toLowerCase();

/**
 * Called whenever a non-whitelisted email attempts to login or signup.
 *
 * 1. Upserts a row into `whitelist_requests` so the admin sees the person
 *    in the Access Requests tab.
 * 2. Sends a Web Push notification to the admin's subscribed devices so
 *    they're alerted immediately.
 *
 * Idempotent + non-blocking: all errors are logged but swallowed, the
 * caller's auth flow is never broken by a failure here.
 */
export async function handleNotWhitelistedAttempt(args: {
  email: string;
  name?: string | null;
  reason?: string | null;
  source: "signup" | "login";
}) {
  const admin = createAdminClient();
  const normalizedEmail = args.email.toLowerCase().trim();

  try {
    // 1. Upsert the access request. Use email as unique key so repeated
    //    attempts don't create duplicate rows.
    const { data: existing } = await admin
      .from("whitelist_requests")
      .select("id, name, status")
      .eq("email", normalizedEmail)
      .maybeSingle();

    let requestId: string | null = null;
    if (existing) {
      requestId = existing.id as string;
      // Only update the name if we received one and the existing row doesn't have it.
      if (args.name && !existing.name) {
        await admin
          .from("whitelist_requests")
          .update({ name: args.name })
          .eq("id", requestId);
      }
    } else {
      const { data: inserted, error: insertError } = await admin
        .from("whitelist_requests")
        .insert({
          email: normalizedEmail,
          name: args.name ?? null,
          reason: args.reason ?? `Attempted ${args.source}`,
          status: "pending",
        })
        .select("id")
        .single();
      if (insertError) throw insertError;
      requestId = inserted?.id as string | null;
    }

    await logEvent({
      service: "auth",
      level: "info",
      tag: `${args.source}.requestCreated`,
      message: `Access request recorded for ${normalizedEmail}`,
      metadata: { requestId, email: normalizedEmail, name: args.name, source: args.source },
    });

    // 2. Find the admin user and push them a notification.
    const { data: authUsers } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const adminUser = authUsers?.users?.find((u) => u.email?.toLowerCase() === ADMIN_EMAIL);
    if (!adminUser) {
      await logEvent({
        service: "auth",
        level: "warn",
        tag: "accessRequest.adminNotFound",
        message: `Admin user ${ADMIN_EMAIL} not found — no push sent`,
        metadata: { email: normalizedEmail },
      });
      return;
    }

    const title = args.source === "signup"
      ? `New signup request: ${args.name || normalizedEmail}`
      : `Login attempt from non-whitelisted email`;
    const body = args.name
      ? `${args.name} (${normalizedEmail}) wants access to Trackify. Tap to review.`
      : `${normalizedEmail} wants access to Trackify. Tap to review.`;

    await sendPushToUser(adminUser.id, {
      title,
      body,
      url: "/admin",
      tag: `access-request-${normalizedEmail}`,
    });
  } catch (err) {
    await logEvent({
      service: "auth",
      level: "error",
      tag: "accessRequest.failed",
      message: `Failed to process access-request handler`,
      metadata: {
        email: normalizedEmail,
        source: args.source,
        error: err instanceof Error ? err.message : String(err),
      },
    });
  }
}
