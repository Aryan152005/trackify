import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push/server";
import { logEvent } from "@/lib/logs/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Max retry attempts before giving up on a reminder's push. */
const MAX_PUSH_ATTEMPTS = 3;

/**
 * Send push notifications for all reminders that are due and not yet notified.
 *
 * Retry-aware: transient delivery failures (network, provider 5xx) no longer
 * swallow the reminder. The cron will re-try on the next tick until either:
 *   - one push lands successfully,
 *   - the user has zero subscriptions, or
 *   - we've failed MAX_PUSH_ATTEMPTS times.
 * In any of those cases, `notified_at` is set and the reminder stops being
 * selected. See migration 031 for the schema and rationale.
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
    .select("id, user_id, title, description, reminder_time, push_attempts")
    .lte("reminder_time", now.toISOString())
    .gte("reminder_time", cutoff.toISOString())
    .eq("is_completed", false)
    .is("notified_at", null)
    .lt("push_attempts", MAX_PUSH_ATTEMPTS)
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
  let gaveUp = 0;

  for (const r of dueReminders) {
    const attemptsSoFar = (r.push_attempts as number | null) ?? 0;
    const nextAttempt = attemptsSoFar + 1;

    const result = await sendPushToUser(r.user_id as string, {
      title: `Reminder: ${r.title}`,
      body: (r.description as string) || "Your reminder is due now.",
      url: "/reminders",
      tag: `reminder-${r.id}`,
    }).catch(() => ({ sent: 0, failed: 1, removed: 0 }));

    totalSent += result.sent;
    totalFailed += result.failed;
    const noSubs = result.sent === 0 && result.failed === 0;
    if (noSubs) usersWithNoSubs++;

    // Decide the terminal state for this reminder:
    //   - sent  > 0            → success, stop retrying.
    //   - no subs              → nothing to deliver, stop (in-app banner only).
    //   - all attempts failed and attempts hit the ceiling → give up.
    //   - otherwise            → leave notified_at NULL so the next cron retries,
    //                            but increment push_attempts.
    const done = result.sent > 0 || noSubs || nextAttempt >= MAX_PUSH_ATTEMPTS;

    if (done) {
      if (result.sent === 0 && !noSubs && nextAttempt >= MAX_PUSH_ATTEMPTS) gaveUp++;
      await admin
        .from("reminders")
        .update({
          notified_at: now.toISOString(),
          push_attempts: nextAttempt,
        })
        .eq("id", r.id);
    } else {
      await admin
        .from("reminders")
        .update({ push_attempts: nextAttempt })
        .eq("id", r.id);
    }
  }

  await logEvent({
    service: "cron",
    level: gaveUp > 0 || totalFailed > 0 ? "warn" : "info",
    tag: "remindersPush.run",
    message: `Reminder push cron — processed ${dueReminders.length}, sent ${totalSent}, gave up on ${gaveUp}`,
    metadata: {
      processed: dueReminders.length,
      sent: totalSent,
      failed: totalFailed,
      usersWithNoSubs,
      gaveUp,
    },
  });

  return NextResponse.json({
    processed: dueReminders.length,
    sent: totalSent,
    failed: totalFailed,
    usersWithNoSubs,
    gaveUp,
  });
}
