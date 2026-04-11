"use server";

import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceId } from "@/lib/workspace/actions";

// ---------------------------------------------------------------------------
// Recent Items — fetches latest activity across all entity types
// ---------------------------------------------------------------------------

export async function getRecentItems(limit = 10) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const workspaceId = await getActiveWorkspaceId();

  const items: {
    id: string;
    type: string;
    title: string;
    url: string;
    updatedAt: string;
  }[] = [];

  // Fetch recent from all types in parallel
  let pagesQ = supabase.from("pages").select("id, title, updated_at")
    .eq("created_by", user.id).eq("is_archived", false)
    .order("updated_at", { ascending: false }).limit(limit);
  let entriesQ = supabase.from("work_entries").select("id, title, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false }).limit(limit);
  let tasksQ = supabase.from("tasks").select("id, title, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false }).limit(limit);
  let boardsQ = supabase.from("boards").select("id, name, updated_at")
    .eq("created_by", user.id)
    .order("updated_at", { ascending: false }).limit(limit);

  if (workspaceId) {
    pagesQ = pagesQ.eq("workspace_id", workspaceId);
    entriesQ = entriesQ.eq("workspace_id", workspaceId);
    tasksQ = tasksQ.eq("workspace_id", workspaceId);
    boardsQ = boardsQ.eq("workspace_id", workspaceId);
  }

  const [pagesRes, entriesRes, tasksRes, boardsRes] = await Promise.all([
    pagesQ, entriesQ, tasksQ, boardsQ,
  ]);

  (pagesRes.data ?? []).forEach((p) =>
    items.push({ id: p.id, type: "page", title: p.title || "Untitled", url: `/notes/${p.id}`, updatedAt: p.updated_at })
  );
  (entriesRes.data ?? []).forEach((e) =>
    items.push({ id: e.id, type: "entry", title: e.title, url: `/entries/${e.id}`, updatedAt: e.updated_at })
  );
  (tasksRes.data ?? []).forEach((t) =>
    items.push({ id: t.id, type: "task", title: t.title, url: `/tasks/${t.id}`, updatedAt: t.updated_at })
  );
  (boardsRes.data ?? []).forEach((b) =>
    items.push({ id: b.id, type: "board", title: b.name, url: `/boards/${b.id}`, updatedAt: b.updated_at })
  );

  // Sort by most recent and take top N
  items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return items.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Duplicate a page
// ---------------------------------------------------------------------------

export async function duplicatePage(pageId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: original } = await supabase
    .from("pages")
    .select("*")
    .eq("id", pageId)
    .single();

  if (!original) throw new Error("Page not found");

  const { data: newPage, error } = await supabase
    .from("pages")
    .insert({
      workspace_id: original.workspace_id,
      title: `${original.title || "Untitled"} (copy)`,
      content: original.content,
      icon: original.icon,
      cover_url: original.cover_url,
      parent_page_id: original.parent_page_id,
      created_by: user.id,
      last_edited_by: user.id,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to duplicate: ${error.message}`);
  return newPage;
}

// ---------------------------------------------------------------------------
// Page templates
// ---------------------------------------------------------------------------

export interface PageTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  content: unknown[];
}

export async function getPageTemplates(): Promise<PageTemplate[]> {
  return [
    {
      id: "meeting-notes",
      name: "Meeting Notes",
      description: "Structured meeting notes with agenda, attendees, and action items",
      icon: "📝",
      content: [
        { type: "heading", content: [{ type: "text", text: "Meeting Notes" }], props: { level: 1 } },
        { type: "heading", content: [{ type: "text", text: "Date" }], props: { level: 3 } },
        { type: "paragraph", content: [{ type: "text", text: "[Today's date]" }] },
        { type: "heading", content: [{ type: "text", text: "Attendees" }], props: { level: 3 } },
        { type: "bulletListItem", content: [{ type: "text", text: "Person 1" }] },
        { type: "bulletListItem", content: [{ type: "text", text: "Person 2" }] },
        { type: "heading", content: [{ type: "text", text: "Agenda" }], props: { level: 3 } },
        { type: "numberedListItem", content: [{ type: "text", text: "Topic 1" }] },
        { type: "numberedListItem", content: [{ type: "text", text: "Topic 2" }] },
        { type: "heading", content: [{ type: "text", text: "Discussion" }], props: { level: 3 } },
        { type: "paragraph", content: [] },
        { type: "heading", content: [{ type: "text", text: "Action Items" }], props: { level: 3 } },
        { type: "checkListItem", content: [{ type: "text", text: "Action item 1" }] },
        { type: "checkListItem", content: [{ type: "text", text: "Action item 2" }] },
      ],
    },
    {
      id: "project-brief",
      name: "Project Brief",
      description: "Project overview with goals, scope, timeline, and stakeholders",
      icon: "🎯",
      content: [
        { type: "heading", content: [{ type: "text", text: "Project Brief" }], props: { level: 1 } },
        { type: "heading", content: [{ type: "text", text: "Overview" }], props: { level: 2 } },
        { type: "paragraph", content: [{ type: "text", text: "Brief description of what this project aims to achieve." }] },
        { type: "heading", content: [{ type: "text", text: "Goals" }], props: { level: 2 } },
        { type: "checkListItem", content: [{ type: "text", text: "Goal 1" }] },
        { type: "checkListItem", content: [{ type: "text", text: "Goal 2" }] },
        { type: "heading", content: [{ type: "text", text: "Scope" }], props: { level: 2 } },
        { type: "paragraph", content: [{ type: "text", text: "What's included and what's not." }] },
        { type: "heading", content: [{ type: "text", text: "Timeline" }], props: { level: 2 } },
        { type: "paragraph", content: [{ type: "text", text: "Key milestones and dates." }] },
        { type: "heading", content: [{ type: "text", text: "Stakeholders" }], props: { level: 2 } },
        { type: "bulletListItem", content: [{ type: "text", text: "Stakeholder 1 — Role" }] },
      ],
    },
    {
      id: "weekly-review",
      name: "Weekly Review",
      description: "Reflect on the week with wins, challenges, and next week's priorities",
      icon: "📊",
      content: [
        { type: "heading", content: [{ type: "text", text: "Weekly Review" }], props: { level: 1 } },
        { type: "heading", content: [{ type: "text", text: "Wins This Week" }], props: { level: 2 } },
        { type: "bulletListItem", content: [{ type: "text", text: "Win 1" }] },
        { type: "heading", content: [{ type: "text", text: "Challenges" }], props: { level: 2 } },
        { type: "bulletListItem", content: [{ type: "text", text: "Challenge 1" }] },
        { type: "heading", content: [{ type: "text", text: "Learnings" }], props: { level: 2 } },
        { type: "paragraph", content: [] },
        { type: "heading", content: [{ type: "text", text: "Next Week Priorities" }], props: { level: 2 } },
        { type: "numberedListItem", content: [{ type: "text", text: "Priority 1" }] },
        { type: "numberedListItem", content: [{ type: "text", text: "Priority 2" }] },
        { type: "numberedListItem", content: [{ type: "text", text: "Priority 3" }] },
      ],
    },
    {
      id: "daily-standup",
      name: "Daily Standup",
      description: "Quick daily standup format: yesterday, today, blockers",
      icon: "☀️",
      content: [
        { type: "heading", content: [{ type: "text", text: "Daily Standup" }], props: { level: 1 } },
        { type: "heading", content: [{ type: "text", text: "Yesterday" }], props: { level: 3 } },
        { type: "bulletListItem", content: [{ type: "text", text: "What I did" }] },
        { type: "heading", content: [{ type: "text", text: "Today" }], props: { level: 3 } },
        { type: "bulletListItem", content: [{ type: "text", text: "What I plan to do" }] },
        { type: "heading", content: [{ type: "text", text: "Blockers" }], props: { level: 3 } },
        { type: "bulletListItem", content: [{ type: "text", text: "None / Describe blocker" }] },
      ],
    },
    {
      id: "blank",
      name: "Blank Page",
      description: "Start from scratch",
      icon: "📄",
      content: [],
    },
  ];
}

// ---------------------------------------------------------------------------
// Create page from template
// ---------------------------------------------------------------------------

export async function createPageFromTemplate(templateId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const workspaceId = await getActiveWorkspaceId();
  if (!workspaceId) throw new Error("No active workspace");

  const templates = await getPageTemplates();
  const template = templates.find((t) => t.id === templateId);
  if (!template) throw new Error("Template not found");

  const { data: page, error } = await supabase
    .from("pages")
    .insert({
      workspace_id: workspaceId,
      title: template.name,
      content: template.content,
      icon: template.icon,
      created_by: user.id,
      last_edited_by: user.id,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create page: ${error.message}`);
  return page;
}
