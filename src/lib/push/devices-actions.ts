"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push/server";

export interface Device {
  id: string;
  user_agent: string | null;
  created_at: string;
  last_used_at: string;
  /** Short label derived from the user agent for display (e.g. "Chrome · Windows"). */
  label: string;
}

import { summarizeUserAgent } from "@/lib/push/user-agent";

export async function listMyDevices(): Promise<Device[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("push_subscriptions")
    .select("id, user_agent, created_at, last_used_at")
    .eq("user_id", user.id)
    .order("last_used_at", { ascending: false });
  if (error) return [];

  return (data ?? []).map((row) => ({
    id: row.id as string,
    user_agent: row.user_agent as string | null,
    created_at: row.created_at as string,
    last_used_at: row.last_used_at as string,
    label: summarizeUserAgent(row.user_agent as string | null),
  }));
}

export async function removeDevice(deviceId: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const admin = createAdminClient();
  await admin
    .from("push_subscriptions")
    .delete()
    .eq("id", deviceId)
    .eq("user_id", user.id);
}

export async function testPushToAllMyDevices(): Promise<{ sent: number; failed: number; removed: number }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return sendPushToUser(user.id, {
    title: "Trackify · cross-device test",
    body: "If you see this on every device where you enabled push, multi-device delivery is working.",
    url: "/reminders",
    tag: "trackify-xdevice-test",
  });
}
