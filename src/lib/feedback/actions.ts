"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push/server";
import { logEvent } from "@/lib/logs/logger";
import { requireAdmin } from "@/lib/admin/actions";

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? "paratakkearyan@gmail.com").toLowerCase();

export async function submitFeedback(data: {
  type: "bug" | "feature" | "general" | "complaint";
  message: string;
  rating?: number;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("name")
    .eq("user_id", user.id)
    .single();

  const senderName = profile?.name ?? user.email?.split("@")[0] ?? "Someone";

  const { data: inserted, error } = await supabase
    .from("user_feedback")
    .insert({
      user_id: user.id,
      email: user.email,
      name: senderName,
      type: data.type,
      message: data.message,
      rating: data.rating,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to submit feedback: ${error.message}`);

  // Fire-and-forget: log + push-notify admin. Never blocks the user's submit.
  try {
    await logEvent({
      service: "other",
      level: "info",
      tag: "feedback.submitted",
      message: `${data.type} feedback from ${senderName}`,
      metadata: { feedbackId: inserted?.id, type: data.type, rating: data.rating },
      userId: user.id,
    });

    const admin = createAdminClient();
    const { data: authUsers } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const adminUser = authUsers?.users?.find((u) => u.email?.toLowerCase() === ADMIN_EMAIL);
    if (adminUser) {
      const emoji = data.type === "bug" ? "🐛" : data.type === "feature" ? "💡" : data.type === "complaint" ? "⚠️" : "💬";
      const preview = data.message.length > 100 ? data.message.slice(0, 100) + "…" : data.message;
      await sendPushToUser(adminUser.id, {
        title: `${emoji} ${data.type} feedback from ${senderName}`,
        body: data.rating ? `Rated ${data.rating}/5 · ${preview}` : preview,
        url: "/admin?tab=feedback",
        tag: `feedback-${inserted?.id}`,
      });
    }
  } catch {
    /* non-critical */
  }
}

export async function submitWhitelistRequest(data: {
  email: string;
  name?: string;
  reason?: string;
}) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("whitelist_requests")
    .insert({
      email: data.email.toLowerCase().trim(),
      name: data.name?.trim() || null,
      reason: data.reason?.trim() || null,
    });

  if (error) throw new Error(`Failed to submit request: ${error.message}`);
}

/** Admin-only: fetch all feedback for the admin review panel. */
export async function getAllFeedback() {
  await requireAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("user_feedback")
    .select("id, user_id, email, name, type, message, rating, status, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Admin-only: update feedback status (new → reviewed → resolved). */
export async function updateFeedbackStatus(
  feedbackId: string,
  status: "new" | "reviewed" | "resolved"
) {
  const adminUser = await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("user_feedback")
    .update({ status })
    .eq("id", feedbackId);
  if (error) throw new Error(error.message);

  await logEvent({
    service: "admin",
    level: "info",
    tag: "feedback.updateStatus",
    message: `Feedback status updated to ${status}`,
    metadata: { feedbackId, status },
    userId: adminUser.id,
  });
}
