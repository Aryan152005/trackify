"use server";

import { createClient } from "@/lib/supabase/server";
import type { TaskStatus, TaskPriority } from "@/lib/types/database";
import type {
  TaskWithSubtasks,
  TaskDependency,
  TaskDependencyWithDetails,
  TaskAutomation,
  DependencyType,
  AutomationTriggerType,
  AutomationActionType,
  AutomationTriggerConfig,
  AutomationActionConfig,
} from "@/lib/types/advanced-tasks";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error("Not authenticated");
  }
  return { supabase, user };
}

// ---------------------------------------------------------------------------
// Subtasks
// ---------------------------------------------------------------------------

export async function getSubtasks(parentTaskId: string) {
  const { supabase } = await getAuthenticatedUser();

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("parent_task_id", parentTaskId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to fetch subtasks: ${error.message}`);
  return data ?? [];
}

export async function createSubtask(
  parentTaskId: string,
  data: {
    title: string;
    description?: string;
    priority?: TaskPriority;
    due_date?: string;
    assigned_to?: string;
  }
) {
  const { supabase, user } = await getAuthenticatedUser();

  // Get parent task to inherit workspace_id
  const { data: parent, error: parentError } = await supabase
    .from("tasks")
    .select("workspace_id, board_id, column_id")
    .eq("id", parentTaskId)
    .single();

  if (parentError || !parent)
    throw new Error(`Parent task not found: ${parentError?.message}`);

  // Find the max position among existing subtasks
  const { data: existing } = await supabase
    .from("tasks")
    .select("position")
    .eq("parent_task_id", parentTaskId)
    .order("position", { ascending: false })
    .limit(1);

  const nextPosition =
    existing && existing.length > 0 ? (existing[0].position ?? 0) + 1 : 0;

  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      user_id: user.id,
      workspace_id: parent.workspace_id,
      parent_task_id: parentTaskId,
      title: data.title,
      description: data.description ?? null,
      priority: data.priority ?? "medium",
      due_date: data.due_date ?? null,
      assigned_to: data.assigned_to ?? null,
      status: "pending" as TaskStatus,
      position: nextPosition,
      labels: [],
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create subtask: ${error.message}`);
  return task;
}

export async function getTaskWithSubtasks(
  taskId: string
): Promise<TaskWithSubtasks> {
  const { supabase } = await getAuthenticatedUser();

  const { data: task, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .single();

  if (error || !task)
    throw new Error(`Task not found: ${error?.message}`);

  const { data: children } = await supabase
    .from("tasks")
    .select("*")
    .eq("parent_task_id", taskId)
    .order("position", { ascending: true });

  const subtasks = children ?? [];
  const completedCount = subtasks.filter((c) => c.status === "done").length;

  return {
    ...task,
    children: subtasks,
    subtask_count: subtasks.length,
    completed_subtask_count: completedCount,
  } as TaskWithSubtasks;
}

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

export async function addDependency(
  workspaceId: string,
  taskId: string,
  dependsOnId: string,
  type: DependencyType = "blocks"
) {
  if (taskId === dependsOnId) {
    throw new Error("A task cannot depend on itself");
  }

  // Check for circular dependency
  const hasCircular = await getDependencyChain(dependsOnId, taskId);
  if (hasCircular) {
    throw new Error(
      "Cannot add dependency: this would create a circular dependency"
    );
  }

  const { supabase } = await getAuthenticatedUser();

  const { data, error } = await supabase
    .from("task_dependencies")
    .insert({
      workspace_id: workspaceId,
      task_id: taskId,
      depends_on: dependsOnId,
      dependency_type: type,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to add dependency: ${error.message}`);
  return data as TaskDependency;
}

export async function removeDependency(dependencyId: string) {
  const { supabase } = await getAuthenticatedUser();

  const { error } = await supabase
    .from("task_dependencies")
    .delete()
    .eq("id", dependencyId);

  if (error) throw new Error(`Failed to remove dependency: ${error.message}`);
}

export async function getTaskDependencies(
  taskId: string
): Promise<{
  blocking: TaskDependencyWithDetails[];
  blockedBy: TaskDependencyWithDetails[];
}> {
  const { supabase } = await getAuthenticatedUser();

  // Tasks that THIS task blocks (depends_on = taskId)
  const { data: blocking, error: err1 } = await supabase
    .from("task_dependencies")
    .select(
      "*, task:tasks!task_dependencies_task_id_fkey(id, title, status, priority)"
    )
    .eq("depends_on", taskId);

  // Tasks that block THIS task (task_id = taskId)
  const { data: blockedBy, error: err2 } = await supabase
    .from("task_dependencies")
    .select(
      "*, depends_on_task:tasks!task_dependencies_depends_on_fkey(id, title, status, priority)"
    )
    .eq("task_id", taskId);

  if (err1) throw new Error(`Failed to fetch blocking: ${err1.message}`);
  if (err2) throw new Error(`Failed to fetch blocked by: ${err2.message}`);

  return {
    blocking: (blocking ?? []) as unknown as TaskDependencyWithDetails[],
    blockedBy: (blockedBy ?? []) as unknown as TaskDependencyWithDetails[],
  };
}

/**
 * Recursively check if adding a dependency from `fromId` would create a cycle
 * that reaches `targetId`. Returns true if circular.
 */
export async function getDependencyChain(
  fromId: string,
  targetId: string,
  visited: Set<string> = new Set()
): Promise<boolean> {
  if (fromId === targetId) return true;
  if (visited.has(fromId)) return false;
  visited.add(fromId);

  const { supabase } = await getAuthenticatedUser();

  const { data: deps } = await supabase
    .from("task_dependencies")
    .select("depends_on")
    .eq("task_id", fromId)
    .eq("dependency_type", "blocks");

  if (!deps || deps.length === 0) return false;

  for (const dep of deps) {
    const isCircular = await getDependencyChain(dep.depends_on, targetId, visited);
    if (isCircular) return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Bulk operations
// ---------------------------------------------------------------------------

export async function bulkUpdateTasks(
  taskIds: string[],
  update: {
    status?: TaskStatus;
    priority?: TaskPriority;
    assigned_to?: string | null;
  }
) {
  if (taskIds.length === 0) return;

  const { supabase } = await getAuthenticatedUser();

  const updateData: Record<string, unknown> = { ...update };
  if (update.status === "done") {
    updateData.completed_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("tasks")
    .update(updateData)
    .in("id", taskIds);

  if (error)
    throw new Error(`Failed to bulk update tasks: ${error.message}`);
}

export async function bulkDeleteTasks(taskIds: string[]) {
  if (taskIds.length === 0) return;

  const { supabase } = await getAuthenticatedUser();

  const { error } = await supabase
    .from("tasks")
    .delete()
    .in("id", taskIds);

  if (error)
    throw new Error(`Failed to bulk delete tasks: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Automations
// ---------------------------------------------------------------------------

export async function createAutomation(
  workspaceId: string,
  automation: {
    name: string;
    trigger_type: AutomationTriggerType;
    trigger_config: AutomationTriggerConfig;
    action_type: AutomationActionType;
    action_config: AutomationActionConfig;
  }
) {
  const { supabase, user } = await getAuthenticatedUser();

  const { data, error } = await supabase
    .from("task_automations")
    .insert({
      workspace_id: workspaceId,
      name: automation.name,
      trigger_type: automation.trigger_type,
      trigger_config: automation.trigger_config,
      action_type: automation.action_type,
      action_config: automation.action_config,
      created_by: user.id,
    })
    .select()
    .single();

  if (error)
    throw new Error(`Failed to create automation: ${error.message}`);
  return data as TaskAutomation;
}

export async function getAutomations(
  workspaceId: string
): Promise<TaskAutomation[]> {
  const { supabase } = await getAuthenticatedUser();

  const { data, error } = await supabase
    .from("task_automations")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error)
    throw new Error(`Failed to fetch automations: ${error.message}`);
  return (data ?? []) as TaskAutomation[];
}

export async function toggleAutomation(
  automationId: string,
  isActive: boolean
) {
  const { supabase } = await getAuthenticatedUser();

  const { error } = await supabase
    .from("task_automations")
    .update({ is_active: isActive })
    .eq("id", automationId);

  if (error)
    throw new Error(`Failed to toggle automation: ${error.message}`);
}

export async function deleteAutomation(automationId: string) {
  const { supabase } = await getAuthenticatedUser();

  const { error } = await supabase
    .from("task_automations")
    .delete()
    .eq("id", automationId);

  if (error)
    throw new Error(`Failed to delete automation: ${error.message}`);
}

export async function executeAutomation(
  automationId: string,
  taskId: string
) {
  const { supabase } = await getAuthenticatedUser();

  // Get the automation
  const { data: automation, error: autoError } = await supabase
    .from("task_automations")
    .select("*")
    .eq("id", automationId)
    .single();

  if (autoError || !automation)
    throw new Error(`Automation not found: ${autoError?.message}`);

  if (!automation.is_active)
    throw new Error("Automation is disabled");

  const actionConfig = automation.action_config as AutomationActionConfig;

  switch (automation.action_type) {
    case "change_status": {
      if (!actionConfig.target_status) break;
      const updateData: Record<string, unknown> = {
        status: actionConfig.target_status,
      };
      if (actionConfig.target_status === "done") {
        updateData.completed_at = new Date().toISOString();
      }
      await supabase
        .from("tasks")
        .update(updateData)
        .eq("id", taskId);
      break;
    }
    case "assign": {
      if (!actionConfig.assign_to) break;
      await supabase
        .from("tasks")
        .update({ assigned_to: actionConfig.assign_to })
        .eq("id", taskId);
      break;
    }
    case "move_column": {
      if (!actionConfig.column_id) break;
      await supabase
        .from("tasks")
        .update({
          column_id: actionConfig.column_id,
          board_id: actionConfig.board_id ?? null,
        })
        .eq("id", taskId);
      break;
    }
    case "notify": {
      // Notification handled via Supabase Realtime or Resend in production
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Search tasks (for dependency picker)
// ---------------------------------------------------------------------------

export async function searchTasks(workspaceId: string, query: string) {
  const { supabase } = await getAuthenticatedUser();

  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, status, priority")
    .eq("workspace_id", workspaceId)
    .ilike("title", `%${query}%`)
    .limit(10);

  if (error) throw new Error(`Failed to search tasks: ${error.message}`);
  return data ?? [];
}
