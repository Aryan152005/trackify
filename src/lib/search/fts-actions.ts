"use server";

import { createClient } from "@/lib/supabase/server";

export type FtsResultType = "task" | "entry" | "page" | "reminder";

export interface FtsResult {
  type: FtsResultType;
  id: string;
  title: string;
  snippet: string;
  href: string;
  updatedAt?: string;
}

function truncate(text: string | null | undefined, max = 100): string {
  if (!text) return "";
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

/**
 * Full-text search across tasks, work_entries, pages, and reminders.
 *
 * Uses Postgres FTS via generated `search_tsv` columns (see migration 021).
 * Scoped to authenticated user; if workspaceId is provided, restricts to that workspace.
 * Returns up to `limit` results total (default 20), sorted by title match first
 * then by most-recent updatedAt.
 */
export async function globalFtsSearch(
  query: string,
  workspaceId: string | null,
  limit: number = 20
): Promise<FtsResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const perType = Math.max(5, Math.ceil(limit / 2));
  const lowerQuery = trimmed.toLowerCase();

  // --- tasks ---
  const tasksPromise = (async () => {
    let q = supabase
      .from("tasks")
      .select("id, title, description, updated_at")
      .textSearch("search_tsv", trimmed, { type: "websearch" })
      .order("updated_at", { ascending: false })
      .limit(perType);
    if (workspaceId) q = q.eq("workspace_id", workspaceId);
    const { data, error } = await q;
    if (error) return [];
    return (data ?? []).map<FtsResult>((r) => ({
      type: "task",
      id: r.id,
      title: r.title ?? "Untitled",
      snippet: truncate(r.description ?? r.title),
      href: `/tasks/${r.id}`,
      updatedAt: r.updated_at,
    }));
  })();

  // --- work_entries ---
  const entriesPromise = (async () => {
    let q = supabase
      .from("work_entries")
      .select("id, title, description, work_done, learning, created_at")
      .textSearch("search_tsv", trimmed, { type: "websearch" })
      .order("created_at", { ascending: false })
      .limit(perType);
    if (workspaceId) q = q.eq("workspace_id", workspaceId);
    const { data, error } = await q;
    if (error) return [];
    return (data ?? []).map<FtsResult>((r) => ({
      type: "entry",
      id: r.id,
      title: r.title ?? "Untitled entry",
      snippet: truncate(r.description ?? r.work_done ?? r.learning ?? r.title),
      href: `/entries/${r.id}`,
      updatedAt: r.created_at,
    }));
  })();

  // --- pages ---
  const pagesPromise = (async () => {
    let q = supabase
      .from("pages")
      .select("id, title, updated_at")
      .textSearch("search_tsv", trimmed, { type: "websearch" })
      .order("updated_at", { ascending: false })
      .limit(perType);
    if (workspaceId) q = q.eq("workspace_id", workspaceId);
    const { data, error } = await q;
    if (error) return [];
    return (data ?? []).map<FtsResult>((r) => ({
      type: "page",
      id: r.id,
      title: r.title || "Untitled",
      snippet: truncate(r.title),
      href: `/notes/${r.id}`,
      updatedAt: r.updated_at,
    }));
  })();

  // --- reminders ---
  const remindersPromise = (async () => {
    let q = supabase
      .from("reminders")
      .select("id, title, description, updated_at")
      .textSearch("search_tsv", trimmed, { type: "websearch" })
      .order("updated_at", { ascending: false })
      .limit(perType);
    if (workspaceId) q = q.eq("workspace_id", workspaceId);
    const { data, error } = await q;
    if (error) return [];
    return (data ?? []).map<FtsResult>((r) => ({
      type: "reminder",
      id: r.id,
      title: r.title ?? "Untitled reminder",
      snippet: truncate(r.description ?? r.title),
      href: `/reminders`,
      updatedAt: r.updated_at,
    }));
  })();

  const [tasks, entries, pages, reminders] = await Promise.all([
    tasksPromise,
    entriesPromise,
    pagesPromise,
    remindersPromise,
  ]);

  const merged = [...tasks, ...entries, ...pages, ...reminders];

  merged.sort((a, b) => {
    const aTitle = a.title.toLowerCase().includes(lowerQuery) ? 0 : 1;
    const bTitle = b.title.toLowerCase().includes(lowerQuery) ? 0 : 1;
    if (aTitle !== bTitle) return aTitle - bTitle;
    const aT = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const bT = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return bT - aT;
  });

  return merged.slice(0, limit);
}
