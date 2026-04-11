"use server";

import { createClient } from "@/lib/supabase/server";

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

  const { error } = await supabase
    .from("user_feedback")
    .insert({
      user_id: user.id,
      email: user.email,
      name: profile?.name ?? "",
      type: data.type,
      message: data.message,
      rating: data.rating,
    });

  if (error) throw new Error(`Failed to submit feedback: ${error.message}`);
}

export async function submitWhitelistRequest(data: {
  email: string;
  name?: string;
  reason?: string;
}) {
  // This uses the anon client — no auth required
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
