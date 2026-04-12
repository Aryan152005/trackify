"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateProfile({ name }: { name: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name cannot be empty");

  const { error } = await supabase
    .from("user_profiles")
    .update({ name: trimmed, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/settings/profile");
  revalidatePath("/settings");
}

export async function updateAvatar(publicUrl: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("user_profiles")
    .update({ avatar_url: publicUrl || null, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/settings/profile");
  revalidatePath("/settings");
}
