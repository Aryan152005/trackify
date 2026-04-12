import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push/server";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

/**
 * Send a test push notification to the currently authenticated user.
 * Used by the "Send test notification" button in settings.
 * Rate-limited per user (5 tests per minute) to prevent spamming.
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limit = rateLimit(`push-test:${user.id}`, 5, 60 * 1000);
  if (!limit.allowed) return rateLimitResponse(limit);

  try {
    const result = await sendPushToUser(user.id, {
      title: "Trackify · test notification",
      body: "Push notifications are working! You'll now get reminders even when the app is closed.",
      url: "/reminders",
      tag: "trackify-test",
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Push failed" },
      { status: 500 }
    );
  }
}
