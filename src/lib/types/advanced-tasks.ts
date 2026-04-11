import type { Task, TaskStatus, TaskPriority } from "./database";

// ---------------------------------------------------------------------------
// Subtasks
// ---------------------------------------------------------------------------

export interface TaskWithSubtasks extends Task {
  parent_task_id: string | null;
  children: Task[];
  subtask_count: number;
  completed_subtask_count: number;
}

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

export type DependencyType = "blocks" | "related";

export interface TaskDependency {
  id: string;
  workspace_id: string;
  task_id: string;
  depends_on: string;
  dependency_type: DependencyType;
  created_at: string;
}

export interface TaskDependencyWithDetails extends TaskDependency {
  task: Pick<Task, "id" | "title" | "status" | "priority">;
  depends_on_task: Pick<Task, "id" | "title" | "status" | "priority">;
}

// ---------------------------------------------------------------------------
// Automations
// ---------------------------------------------------------------------------

export type AutomationTriggerType =
  | "status_change"
  | "due_date_passed"
  | "assigned"
  | "created";

export type AutomationActionType =
  | "change_status"
  | "assign"
  | "notify"
  | "move_column";

export interface AutomationTriggerConfig {
  /** For status_change: which status triggers the automation */
  from_status?: TaskStatus;
  to_status?: TaskStatus;
  /** For assigned: the user id */
  assigned_to?: string;
}

export interface AutomationActionConfig {
  /** For change_status */
  target_status?: TaskStatus;
  /** For assign */
  assign_to?: string;
  /** For move_column */
  column_id?: string;
  board_id?: string;
  /** For notify */
  message?: string;
}

export interface TaskAutomation {
  id: string;
  workspace_id: string;
  name: string;
  trigger_type: AutomationTriggerType;
  trigger_config: AutomationTriggerConfig;
  action_type: AutomationActionType;
  action_config: AutomationActionConfig;
  is_active: boolean;
  created_by: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Bulk operations
// ---------------------------------------------------------------------------

export interface BulkOperation {
  task_ids: string[];
  action:
    | { type: "change_status"; status: TaskStatus }
    | { type: "change_priority"; priority: TaskPriority }
    | { type: "assign"; assigned_to: string | null }
    | { type: "delete" };
}
