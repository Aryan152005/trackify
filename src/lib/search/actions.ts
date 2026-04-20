"use server";

import { createClient } from "@/lib/supabase/server";
import type { SearchResult, SearchFilters, QuickAction } from "./types";

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

async function getAuthenticatedClient() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Not authenticated");
  return { supabase, user };
}

// ---------------------------------------------------------------------------
// Helper: Escape special characters in ILIKE patterns to prevent injection
// ---------------------------------------------------------------------------

function escapeIlike(input: string): string {
  return input.replace(/[%_\\]/g, (ch) => `\\${ch}`);
}

// ---------------------------------------------------------------------------
// Helper: extract a short highlight snippet around the matched term
// ---------------------------------------------------------------------------
function extractHighlight(
  text: string | null | undefined,
  query: string,
  maxLen = 120
): string | undefined {
  if (!text) return undefined;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return text.slice(0, maxLen);
  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + query.length + 80);
  let snippet = text.slice(start, end).trim();
  if (start > 0) snippet = "..." + snippet;
  if (end < text.length) snippet = snippet + "...";
  return snippet;
}

// ---------------------------------------------------------------------------
// Icon mapping per entity type
// ---------------------------------------------------------------------------
const TYPE_ICONS: Record<string, string> = {
  page: "FileText",
  task: "CheckSquare",
  entry: "Clock",
  board: "Columns",
  mindmap: "GitBranch",
  calendar_event: "CalendarDays",
  reminder: "Bell",
  comment: "MessageSquare",
};

// ---------------------------------------------------------------------------
// globalSearch
// ---------------------------------------------------------------------------
export async function globalSearch(
  workspaceId: string,
  query: string,
  filters?: SearchFilters
): Promise<SearchResult[]> {
  const { supabase } = await getAuthenticatedClient();
  const trimmed = query.trim();
  if (!trimmed) return [];

  const perType = filters?.limit ?? 5;
  const pattern = `%${escapeIlike(trimmed)}%`;
  const allowedTypes = filters?.types;

  const results: SearchResult[] = [];

  // Helper to decide if a type should be searched
  const shouldSearch = (t: string) => !allowedTypes || allowedTypes.includes(t as any);

  // ---- Pages ----
  if (shouldSearch("page")) {
    const { data } = await supabase
      .from("pages")
      .select("id, title, updated_at")
      .eq("workspace_id", workspaceId)
      .or(`title.ilike.${pattern}`)
      .order("updated_at", { ascending: false })
      .limit(perType);

    (data ?? []).forEach((r) =>
      results.push({
        id: r.id,
        type: "page",
        title: r.title || "Untitled",
        url: `/notes/${r.id}`,
        icon: TYPE_ICONS.page,
        updatedAt: r.updated_at,
        highlight: extractHighlight(r.title, trimmed),
      })
    );
  }

  // ---- Tasks ----
  if (shouldSearch("task")) {
    const { data } = await supabase
      .from("tasks")
      .select("id, title, description, status, updated_at")
      .eq("workspace_id", workspaceId)
      .or(`title.ilike.${pattern},description.ilike.${pattern}`)
      .order("updated_at", { ascending: false })
      .limit(perType);

    (data ?? []).forEach((r) =>
      results.push({
        id: r.id,
        type: "task",
        title: r.title,
        subtitle: r.status ? `Status: ${r.status}` : undefined,
        url: `/tasks?id=${r.id}`,
        icon: TYPE_ICONS.task,
        updatedAt: r.updated_at,
        highlight: extractHighlight(r.description ?? r.title, trimmed),
      })
    );
  }

  // ---- Work Entries ----
  if (shouldSearch("entry")) {
    const { data } = await supabase
      .from("work_entries")
      .select("id, title, description, updated_at")
      .eq("workspace_id", workspaceId)
      .or(`title.ilike.${pattern},description.ilike.${pattern}`)
      .order("updated_at", { ascending: false })
      .limit(perType);

    (data ?? []).forEach((r) =>
      results.push({
        id: r.id,
        type: "entry",
        title: r.title,
        subtitle: r.description?.slice(0, 60) || undefined,
        url: `/entries/${r.id}`,
        icon: TYPE_ICONS.entry,
        updatedAt: r.updated_at,
        highlight: extractHighlight(r.description ?? r.title, trimmed),
      })
    );
  }

  // ---- Boards ----
  if (shouldSearch("board")) {
    const { data } = await supabase
      .from("boards")
      .select("id, name, updated_at")
      .eq("workspace_id", workspaceId)
      .ilike("name", pattern)
      .order("updated_at", { ascending: false })
      .limit(perType);

    (data ?? []).forEach((r) =>
      results.push({
        id: r.id,
        type: "board",
        title: r.name,
        url: `/boards/${r.id}`,
        icon: TYPE_ICONS.board,
        updatedAt: r.updated_at,
        highlight: extractHighlight(r.name, trimmed),
      })
    );
  }

  // ---- Mind Maps ----
  if (shouldSearch("mindmap")) {
    const { data } = await supabase
      .from("mindmaps")
      .select("id, title, updated_at")
      .eq("workspace_id", workspaceId)
      .ilike("title", pattern)
      .order("updated_at", { ascending: false })
      .limit(perType);

    (data ?? []).forEach((r) =>
      results.push({
        id: r.id,
        type: "mindmap",
        title: r.title || "Untitled",
        url: `/mindmaps/${r.id}`,
        icon: TYPE_ICONS.mindmap,
        updatedAt: r.updated_at,
        highlight: extractHighlight(r.title, trimmed),
      })
    );
  }

  // ---- Calendar Events ----
  if (shouldSearch("calendar_event")) {
    const { data } = await supabase
      .from("calendar_events")
      .select("id, title, start_time, updated_at")
      .eq("workspace_id", workspaceId)
      .ilike("title", pattern)
      .order("updated_at", { ascending: false })
      .limit(perType);

    (data ?? []).forEach((r) =>
      results.push({
        id: r.id,
        type: "calendar_event",
        title: r.title,
        subtitle: r.start_time
          ? new Date(r.start_time).toLocaleDateString()
          : undefined,
        url: `/calendar?event=${r.id}`,
        icon: TYPE_ICONS.calendar_event,
        updatedAt: r.updated_at,
        highlight: extractHighlight(r.title, trimmed),
      })
    );
  }

  // ---- Reminders ----
  if (shouldSearch("reminder")) {
    const { data } = await supabase
      .from("reminders")
      .select("id, title, reminder_time, updated_at")
      .eq("workspace_id", workspaceId)
      .ilike("title", pattern)
      .order("updated_at", { ascending: false })
      .limit(perType);

    (data ?? []).forEach((r) =>
      results.push({
        id: r.id,
        type: "reminder",
        title: r.title,
        subtitle: r.reminder_time
          ? `Due ${new Date(r.reminder_time).toLocaleDateString()}`
          : undefined,
        url: `/reminders`,
        icon: TYPE_ICONS.reminder,
        updatedAt: r.updated_at,
        highlight: extractHighlight(r.title, trimmed),
      })
    );
  }

  // ---- Comments ----
  if (shouldSearch("comment")) {
    const { data } = await supabase
      .from("comments")
      .select("id, content, created_at")
      .eq("workspace_id", workspaceId)
      .ilike("content", pattern)
      .order("created_at", { ascending: false })
      .limit(perType);

    (data ?? []).forEach((r) =>
      results.push({
        id: r.id,
        type: "comment",
        title: (r.content ?? "").slice(0, 80),
        url: "#",
        icon: TYPE_ICONS.comment,
        updatedAt: r.created_at,
        highlight: extractHighlight(r.content, trimmed),
      })
    );
  }

  // Sort combined results by recency
  results.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return results;
}

// ---------------------------------------------------------------------------
// getRecentItems
// ---------------------------------------------------------------------------
export async function getRecentItems(
  workspaceId: string,
  _userId: string,
  limit = 8
): Promise<SearchResult[]> {
  const { supabase } = await getAuthenticatedClient();
  const results: SearchResult[] = [];

  // Fetch recent pages
  const { data: pages } = await supabase
    .from("pages")
    .select("id, title, updated_at")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  (pages ?? []).forEach((r) =>
    results.push({
      id: r.id,
      type: "page",
      title: r.title || "Untitled",
      url: `/notes/${r.id}`,
      icon: TYPE_ICONS.page,
      updatedAt: r.updated_at,
    })
  );

  // Fetch recent tasks
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, status, updated_at")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  (tasks ?? []).forEach((r) =>
    results.push({
      id: r.id,
      type: "task",
      title: r.title,
      subtitle: r.status ? `Status: ${r.status}` : undefined,
      url: `/tasks?id=${r.id}`,
      icon: TYPE_ICONS.task,
      updatedAt: r.updated_at,
    })
  );

  // Fetch recent entries
  const { data: entries } = await supabase
    .from("work_entries")
    .select("id, title, updated_at")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  (entries ?? []).forEach((r) =>
    results.push({
      id: r.id,
      type: "entry",
      title: r.title,
      url: `/entries/${r.id}`,
      icon: TYPE_ICONS.entry,
      updatedAt: r.updated_at,
    })
  );

  // Sort and take top N
  results.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return results.slice(0, limit);
}

// ---------------------------------------------------------------------------
// getQuickActions
// ---------------------------------------------------------------------------
export async function getQuickActions(): Promise<QuickAction[]> {
  return [
    // ── Create ────────────────────────────────────────────
    { id: "create-task", label: "New task", icon: "ListPlus", shortcut: "C T", action: "/tasks/new", category: "create" },
    { id: "create-page", label: "New note", icon: "FilePlus", shortcut: "C N", action: "/notes/new", category: "create" },
    { id: "create-entry", label: "Log work entry", icon: "PenLine", shortcut: "C E", action: "/entries/new", category: "create" },
    { id: "create-reminder", label: "New reminder", icon: "Bell", shortcut: "C R", action: "/reminders/new", category: "create" },
    { id: "create-board", label: "New board", icon: "Columns", shortcut: "C B", action: "/boards/new", category: "create" },
    { id: "create-mindmap", label: "New mind map", icon: "GitBranch", action: "/mindmaps?new=1", category: "create" },
    { id: "create-drawing", label: "New drawing", icon: "PenLine", action: "/drawings?new=1", category: "create" },
    { id: "create-challenge", label: "New challenge", icon: "GitBranch", action: "/challenges/new", category: "create" },

    // ── Navigate (primary, high-frequency) ────────────────
    { id: "nav-today", label: "Go to Today", icon: "CalendarDays", shortcut: "G T", action: "/today", category: "navigate" },
    { id: "nav-inbox", label: "Go to Inbox", icon: "MessageSquare", shortcut: "G I", action: "/inbox", category: "navigate" },
    { id: "nav-tasks", label: "Go to Tasks", icon: "CheckSquare", shortcut: "G K", action: "/tasks", category: "navigate" },
    { id: "nav-notes", label: "Go to Notes", icon: "FileText", shortcut: "G N", action: "/notes", category: "navigate" },
    { id: "nav-boards", label: "Go to Boards", icon: "Columns", shortcut: "G B", action: "/boards", category: "navigate" },
    { id: "nav-dashboard", label: "Go to Dashboard", icon: "LayoutGrid", shortcut: "G D", action: "/dashboard", category: "navigate" },

    // ── Navigate (secondary) ──────────────────────────────
    { id: "nav-calendar", label: "Go to Calendar", icon: "CalendarDays", action: "/calendar", category: "navigate" },
    { id: "nav-reminders", label: "Go to Reminders", icon: "Bell", action: "/reminders", category: "navigate" },
    { id: "nav-mindmaps", label: "Go to Mind maps", icon: "GitBranch", action: "/mindmaps", category: "navigate" },
    { id: "nav-drawings", label: "Go to Drawings", icon: "PenLine", action: "/drawings", category: "navigate" },
    { id: "nav-challenges", label: "Go to Challenges", icon: "GitBranch", action: "/challenges", category: "navigate" },
    { id: "nav-timeline", label: "Go to Timeline", icon: "Clock", action: "/timeline", category: "navigate" },
    { id: "nav-analytics", label: "Go to Analytics", icon: "BarChart3", action: "/analytics", category: "navigate" },
    { id: "nav-reports", label: "Go to Reports", icon: "FileText", action: "/reports", category: "navigate" },
    { id: "nav-notifications", label: "Go to Notifications", icon: "Bell", action: "/notifications", category: "navigate" },
    { id: "nav-mentions", label: "Go to Mentions", icon: "MessageSquare", action: "/mentions", category: "navigate" },
    { id: "nav-personal", label: "Personal space", icon: "FileText", action: "/personal", category: "navigate" },
    { id: "nav-workspace-members", label: "Team members", icon: "Settings", action: "/workspace/members", category: "navigate" },
    { id: "nav-workspace-activity", label: "Workspace activity", icon: "Clock", action: "/workspace/activity", category: "navigate" },
    { id: "nav-shared-links", label: "Shared links audit", icon: "Settings", action: "/workspace/shared-links", category: "navigate" },

    // ── Settings ──────────────────────────────────────────
    { id: "settings-preferences", label: "Preferences", icon: "Settings", shortcut: "G P", action: "/settings/preferences", category: "settings" },
    { id: "settings-profile", label: "Edit profile", icon: "Settings", action: "/settings/profile", category: "settings" },
    { id: "settings-workspace", label: "Workspace settings", icon: "Settings", action: "/workspace", category: "settings" },
    { id: "settings-help", label: "Help & walkthrough", icon: "MessageSquare", shortcut: "?", action: "/help", category: "settings" },
  ];
}
