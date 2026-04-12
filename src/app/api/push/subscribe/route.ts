import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logEvent } from "@/lib/logs/logger";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let subscription: PushSubscriptionJSON;
  try {
    const body = await request.json();
    subscription = body.subscription;
    if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const admin = createAdminClient();
  const userAgent = request.headers.get("user-agent") ?? null;

  const { error } = await admin
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        user_agent: userAgent,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" }
    );

  if (error) {
    await logEvent({
      service: "other",
      level: "error",
      tag: "push.subscribe",
      message: `Failed to save subscription: ${error.message}`,
      metadata: { code: error.code },
      userId: user.id,
    });
    return NextResponse.json({ error: "Failed to save subscription" }, { status: 500 });
  }

  await logEvent({
    service: "other",
    level: "info",
    tag: "push.subscribe",
    message: `Push subscription saved`,
    metadata: { userAgent },
    userId: user.id,
  });

  return NextResponse.json({ success: true });
}
