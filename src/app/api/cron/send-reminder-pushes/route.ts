import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push/server";
import { logEvent } from "@/lib/logs/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Send push notifications for all reminders that are due and not yet notified.
 *
 * Idempotent: each reminder is marked `notified_at` as soon as we've attempted
 * delivery, so running this cron every minute (or every hour) produces the
 * same outcome.
 *
 * Considered "due" if:
 *   - reminder_time <= now()
 *   - reminder_time >= now() - 24h   (don't send for reminders older than a day)
 *   - is_completed = false
 *   - notified_at IS NULL
 *
 * Authentication: requires `Authorization: Bearer <CRON_SECRET>`.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    await logEvent({
      service: "cron",
      level: "warn",
      tag: "remindersPush.unauthorized",
      message: `Reminder push cron invoked with bad or missing secret`,
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const cutoff = new Date(now.getTime() - 24 * 3600 * 1000);

  const { data: dueReminders, error } = await admin
    .from("reminders")
    .select("id, user_id, title, description, reminder_time")
    .lte("reminder_time", now.toISOString())
    .gte("reminder_time", cutoff.toISOString())
    .eq("is_completed", false)
    .is("notified_at", null)
    .order("reminder_time", { ascending: true })
    .limit(100); // safety cap per run

  if (error) {
    await logEvent({
      service: "cron",
      level: "error",
      tag: "remindersPush.queryFailed",
      message: `Failed to fetch due reminders: ${error.message}`,
      metadata: { code: error.code },
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!dueReminders || dueReminders.length === 0) {
    return NextResponse.json({ processed: 0, sent: 0 });
  }

  let totalSent = 0;
  let totalFailed = 0;
  let usersWithNoSubs = 0;

  for (const r of dueReminders) {
    const result = await sendPushToUser(r.user_id as string, {
      title: `Reminder: ${r.title}`,
      body: (r.description as string) || "Your reminder is due now.",
      url: "/reminders",
      tag: `reminder-${r.id}`,
    }).catch(() => ({ sent: 0, failed: 1, removed: 0 }));

    totalSent += result.sent;
    totalFailed += result.failed;
    if (result.sent === 0 && result.failed === 0) usersWithNoSubs++;

    // Mark as notified regardless — we don't want to retry forever if
    // the user has no subscriptions (they'll see it in-app next time).
    await admin
      .from("reminders")
      .update({ notified_at: now.toISOString() })
      .eq("id", r.id);
  }

  await logEvent({
    service: "cron",
    level: totalFailed > 0 ? "warn" : "info",
    tag: "remindersPush.run",
    message: `Reminder push cron — processed ${dueReminders.length}, sent ${totalSent}`,
    metadata: {
      processed: dueReminders.length,
      sent: totalSent,
      failed: totalFailed,
      usersWithNoSubs,
    },
  });

  return NextResponse.json({
    processed: dueReminders.length,
    sent: totalSent,
    failed: totalFailed,
    usersWithNoSubs,
  });
}
