"use server";

import { createClient } from "@/lib/supabase/server";

export async function getPinnedNavItems(): Promise<string[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("user_profiles")
    .select("personal_dashboard_config")
    .eq("user_id", user.id)
    .maybeSingle();
  const config = (data?.personal_dashboard_config ?? {}) as { pinnedNav?: string[] };
  return Array.isArray(config.pinnedNav) ? config.pinnedNav : [];
}

export async function togglePinNavItem(href: string): Promise<string[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("personal_dashboard_config")
    .eq("user_id", user.id)
    .maybeSingle();

  const config = (profile?.personal_dashboard_config ?? {}) as { pinnedNav?: string[] };
  const current = Array.isArray(config.pinnedNav) ? config.pinnedNav : [];
  const next = current.includes(href)
    ? current.filter((h) => h !== href)
    : [...current, href];

  await supabase
    .from("user_profiles")
    .update({ personal_dashboard_config: { ...config, pinnedNav: next } })
    .eq("user_id", user.id);

  return next;
}
