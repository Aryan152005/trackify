import { NextResponse } from "next/server";
import { logEvent } from "@/lib/logs/logger";

/**
 * Daily entry reminder cron — currently disabled.
 *
 * Email sending has been removed from the app (no Resend dependency).
 * To re-enable automated email reminders, wire a new provider here
 * and restore the original logic from git history.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    await logEvent({
      service: "cron",
      level: "warn",
      tag: "dailyEntryReminder.unauthorized",
      message: `Cron invoked with bad or missing secret`,
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await logEvent({
    service: "cron",
    level: "info",
    tag: "dailyEntryReminder.skipped",
    message: `Daily entry reminder skipped — email sending disabled`,
  });

  return NextResponse.json({
    status: "disabled",
    message: "Automated email reminders are disabled. Send manually from the admin UI.",
  });
}
