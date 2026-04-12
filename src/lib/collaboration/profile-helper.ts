import type { SupabaseClient } from "@supabase/supabase-js";

export interface UserProfileLite {
  name: string;
  avatar_url: string | null;
}

// PostgREST cannot embed user_profiles via FK hints because the FKs point at
// auth.users, not user_profiles. This helper does the second lookup instead.
export async function fetchProfileMap(
  supabase: SupabaseClient,
  userIds: (string | null | undefined)[]
): Promise<Map<string, UserProfileLite>> {
  const ids = [...new Set(userIds.filter(Boolean) as string[])];
  const map = new Map<string, UserProfileLite>();
  if (ids.length === 0) return map;
  const { data } = await supabase
    .from("user_profiles")
    .select("user_id, name, avatar_url")
    .in("user_id", ids);
  for (const p of data ?? []) {
    map.set(p.user_id as string, {
      name: (p.name as string) ?? "",
      avatar_url: (p.avatar_url as string) ?? null,
    });
  }
  return map;
}
