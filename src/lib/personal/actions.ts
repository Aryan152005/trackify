"use server";

import { createClient } from "@/lib/supabase/server";
import type { PersonalDashboardConfig, PersonalStats } from "./types";
import { DEFAULT_DASHBOARD_CONFIG } from "./types";

async function getAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

export async function getPersonalPages(workspaceId: string) {
  const { supabase, user } = await getAuthUser();
  const { data, error } = await supabase
    .from("pages")
    .select("id, title, icon, updated_at, is_archived")
    .eq("workspace_id", workspaceId)
    .eq("is_private", true)
    .eq("created_by", user.id)
    .eq("is_archived", false)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function getPersonalTasks(workspaceId: string) {
  const { supabase, user } = await getAuthUser();
  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, status, priority, due_date, due_time, created_at")
    .eq("workspace_id", workspaceId)
    .eq("is_private", true)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function getPersonalEntries(workspaceId: string) {
  const { supabase, user } = await getAuthUser();
  const { data, error } = await supabase
    .from("work_entries")
    .select("id, title, date, status, productivity_score, created_at")
    .eq("workspace_id", workspaceId)
    .eq("is_private", true)
    .eq("user_id", user.id)
    .order("date", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function getPersonalBoards(workspaceId: string) {
  const { supabase, user } = await getAuthUser();
  const { data, error } = await supabase
    .from("boards")
    .select("id, name, description, updated_at")
    .eq("workspace_id", workspaceId)
    .eq("is_private", true)
    .eq("created_by", user.id)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function getPersonalReminders(workspaceId: string) {
  const { supabase, user } = await getAuthUser();
  const { data, error } = await supabase
    .from("reminders")
    .select("id, title, reminder_time, is_completed, is_recurring")
    .eq("workspace_id", workspaceId)
    .eq("is_private", true)
    .eq("user_id", user.id)
    .order("reminder_time", { ascending: true });
  if (error) throw new Error(error.message);
  return data;
}

export async function togglePrivate(
  entityType: string,
  entityId: string,
  isPrivate: boolean
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const table = getTableName(entityType);
  const ownerColumn = getOwnerColumn(entityType);

  // Verify ownership before toggling
  const { data: item, error: fetchError } = await supabase
    .from(table)
    .select("id, " + ownerColumn)
    .eq("id", entityId)
    .single();

  if (fetchError || !item) throw new Error("Item not found");
  if ((item as unknown as Record<string, unknown>)[ownerColumn] !== user.id) {
    throw new Error("Only the owner can change privacy settings");
  }

  const { error } = await supabase
    .from(table)
    .update({ is_private: isPrivate })
    .eq("id", entityId);

  if (error) throw new Error(error.message);
  return { success: true, isPrivate };
}

export async function getPersonalDashboardConfig(
  userId: string
): Promise<PersonalDashboardConfig> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_profiles")
    .select("personal_dashboard_config")
    .eq("user_id", userId)
    .single();

  if (!data?.personal_dashboard_config) return DEFAULT_DASHBOARD_CONFIG;
  return {
    ...DEFAULT_DASHBOARD_CONFIG,
    ...(data.personal_dashboard_config as Partial<PersonalDashboardConfig>),
  };
}

export async function savePersonalDashboardConfig(
  userId: string,
  config: PersonalDashboardConfig
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("user_profiles")
    .update({ personal_dashboard_config: config as unknown as Record<string, unknown> })
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
  return { success: true };
}

export async function getPersonalStats(
  workspaceId: string
): Promise<PersonalStats> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const [pagesRes, tasksRes, entriesRes, boardsRes, remindersRes] =
    await Promise.all([
      supabase
        .from("pages")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("is_private", true)
        .eq("created_by", user.id)
        .eq("is_archived", false),
      supabase
        .from("tasks")
        .select("id, status")
        .eq("workspace_id", workspaceId)
        .eq("is_private", true)
        .eq("user_id", user.id),
      supabase
        .from("work_entries")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("is_private", true)
        .eq("user_id", user.id),
      supabase
        .from("boards")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("is_private", true)
        .eq("created_by", user.id),
      supabase
        .from("reminders")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("is_private", true)
        .eq("user_id", user.id),
    ]);

  const tasks = tasksRes.data || [];

  return {
    privatePages: pagesRes.count ?? 0,
    privateTasks: {
      total: tasks.length,
      pending: tasks.filter((t) => t.status === "pending").length,
      inProgress: tasks.filter((t) => t.status === "in-progress").length,
      done: tasks.filter((t) => t.status === "done").length,
    },
    privateEntries: entriesRes.count ?? 0,
    privateBoards: boardsRes.count ?? 0,
    privateReminders: remindersRes.count ?? 0,
  };
}

// Helpers

function getTableName(entityType: string): string {
  const map: Record<string, string> = {
    pages: "pages",
    tasks: "tasks",
    entries: "work_entries",
    boards: "boards",
    reminders: "reminders",
    mindmaps: "mindmaps",
    drawings: "drawings",
  };
  const table = map[entityType];
  if (!table) throw new Error(`Unknown entity type: ${entityType}`);
  return table;
}

function getOwnerColumn(entityType: string): string {
  // Tables that use created_by vs user_id
  const createdByTables = ["pages", "boards", "mindmaps", "drawings"];
  return createdByTables.includes(entityType) ? "created_by" : "user_id";
}
