"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  DEFAULT_PREFERENCES,
  normalizePreferences,
  type UserPreferences,
} from "@/lib/preferences/types";

// ─── New UI/UX preferences (migration 034) ─────────────────────────────────

/**
 * Always returns a full `UserPreferences` — missing keys fall back to
 * defaults so callers never have to null-check.
 */
export async function getUserPreferences(): Promise<UserPreferences> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return DEFAULT_PREFERENCES;
    const { data } = await supabase
      .from("user_profiles")
      .select("preferences")
      .eq("user_id", user.id)
      .maybeSingle();
    return normalizePreferences(
      (data?.preferences as Partial<UserPreferences> | null) ?? null,
    );
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

/**
 * Read-modify-write merge — required because `.update({ preferences: patch })`
 * replaces the entire JSONB column, which would wipe keys the UI doesn't know
 * about (e.g. a newer deploy writing a new pref, then an older tab saving).
 */
export async function updateUserPreferences(
  patch: Partial<UserPreferences>,
): Promise<UserPreferences> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: existing } = await supabase
    .from("user_profiles")
    .select("preferences")
    .eq("user_id", user.id)
    .maybeSingle();
  const current = normalizePreferences(
    (existing?.preferences as Partial<UserPreferences> | null) ?? null,
  );
  const merged: UserPreferences = { ...current, ...patch };

  const { error } = await supabase
    .from("user_profiles")
    .update({ preferences: merged as unknown as Record<string, unknown> })
    .eq("user_id", user.id);
  if (error) throw new Error(`Failed to save preferences: ${error.message}`);

  // Re-render everything because the provider reads prefs on the server
  // (for SSR accent + density) and the client needs them in sync.
  revalidatePath("/", "layout");
  return merged;
}

// ─── Legacy nav-pin preferences (unchanged) ────────────────────────────────

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
