"use server";

import { createClient } from "@/lib/supabase/server";

export interface PageHistoryEntry {
  id: string;
  action: string;
  userId: string;
  userName: string | null;
  userAvatar: string | null;
  createdAt: string;
}

export interface PageHistory {
  createdBy: { id: string; name: string | null; avatar: string | null } | null;
  createdAt: string | null;
  lastEditedBy: { id: string; name: string | null; avatar: string | null } | null;
  lastEditedAt: string | null;
  entries: PageHistoryEntry[]; // capped to last 50
}

export async function getPageHistory(pageId: string): Promise<PageHistory | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Get page metadata (RLS-gated — only visible if user can see it)
  const { data: page } = await supabase
    .from("pages")
    .select("created_by, last_edited_by, created_at, updated_at")
    .eq("id", pageId)
    .maybeSingle();
  if (!page) return null;

  // Collect user ids to resolve profiles in a single query
  const ids = new Set<string>();
  if (page.created_by) ids.add(page.created_by as string);
  if (page.last_edited_by) ids.add(page.last_edited_by as string);

  const { data: logs } = await supabase
    .from("activity_log")
    .select("id, action, user_id, created_at")
    .eq("entity_type", "page")
    .eq("entity_id", pageId)
    .order("created_at", { ascending: false })
    .limit(50);

  (logs ?? []).forEach((l) => { if (l.user_id) ids.add(l.user_id as string); });

  const { data: profiles } = ids.size > 0
    ? await supabase.from("user_profiles")
        .select("user_id, name, avatar_url")
        .in("user_id", Array.from(ids))
    : { data: [] };
  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.user_id as string, { name: p.name as string | null, avatar: p.avatar_url as string | null }])
  );
  const resolve = (id: string | null) => {
    if (!id) return null;
    const p = profileMap.get(id);
    return { id, name: p?.name ?? null, avatar: p?.avatar ?? null };
  };

  return {
    createdBy: resolve(page.created_by as string | null),
    createdAt: page.created_at as string | null,
    lastEditedBy: resolve(page.last_edited_by as string | null),
    lastEditedAt: page.updated_at as string | null,
    entries: (logs ?? []).map((l) => {
      const p = profileMap.get(l.user_id as string);
      return {
        id: l.id as string,
        action: l.action as string,
        userId: l.user_id as string,
        userName: p?.name ?? null,
        userAvatar: p?.avatar ?? null,
        createdAt: l.created_at as string,
      };
    }),
  };
}
