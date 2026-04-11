/**
 * Database types for Trackify (Work Intelligence System).
 * Match the schema in supabase/migrations/001_initial_schema.sql and 004_phase2_features.sql
 */

export type WorkEntryStatus = "done" | "in-progress" | "blocked";
export type AttachmentType = "image" | "pdf" | "doc";
export type HolidayType = "public" | "personal";
export type TaskStatus = "pending" | "in-progress" | "done" | "cancelled";
export type TaskPriority = "low" | "medium" | "high";
export type ThemePreference = "light" | "dark" | "system";

export interface WorkEntry {
  id: string;
  user_id: string;
  workspace_id: string | null;
  date: string;
  title: string;
  description: string | null;
  work_done: string | null;
  learning: string | null;
  next_day_plan: string | null;
  mood: string | null;
  productivity_score: number | null;
  status: WorkEntryStatus;
  created_at: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  workspace_id: string | null;
}

export interface EntryTag {
  entry_id: string;
  tag_id: string;
}

export interface Attachment {
  id: string;
  entry_id: string;
  file_url: string;
  type: AttachmentType;
}

export interface Holiday {
  id: string;
  date: string;
  name: string;
  type: HolidayType;
}

export interface UserProfile {
  id: string;
  user_id: string;
  name: string;
  avatar_url: string | null;
  timezone: string;
  theme_preference: ThemePreference;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  workspace_id: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  due_time: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  completed_at: string | null;
  board_id: string | null;
  column_id: string | null;
  position: number;
  assigned_to: string | null;
  parent_task_id: string | null;
  labels: import("./board").Label[];
  created_at: string;
  updated_at: string;
}

export interface Reminder {
  id: string;
  user_id: string;
  workspace_id: string | null;
  title: string;
  description: string | null;
  reminder_time: string;
  is_recurring: boolean;
  recurrence_pattern: string | null;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
}

export interface TimerSession {
  id: string;
  user_id: string;
  workspace_id: string | null;
  entry_id: string | null;
  task_id: string | null;
  duration_seconds: number;
  started_at: string;
  ended_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface DailyMotivation {
  id: string;
  user_id: string;
  workspace_id: string | null;
  date: string;
  quote: string | null;
  reflection: string | null;
  gratitude: string | null;
  mood: string | null;
  created_at: string;
}

export interface Habit {
  id: string;
  user_id: string;
  workspace_id: string | null;
  name: string;
  description: string | null;
  color: string;
  frequency: "daily" | "weekly" | "custom";
  target_days: number;
  created_at: string;
  updated_at: string;
}

export interface HabitLog {
  id: string;
  habit_id: string;
  date: string;
  notes: string | null;
  created_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  workspace_id: string | null;
  title: string;
  description: string | null;
  target_date: string | null;
  status: "active" | "completed" | "paused" | "cancelled";
  progress: number;
  category: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoalMilestone {
  id: string;
  goal_id: string;
  title: string;
  description: string | null;
  target_date: string | null;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
}

export interface WorkEntryInsert {
  user_id: string;
  workspace_id: string;
  date: string;
  title: string;
  description?: string | null;
  work_done?: string | null;
  learning?: string | null;
  next_day_plan?: string | null;
  mood?: string | null;
  productivity_score?: number | null;
  status?: WorkEntryStatus;
}

export interface WorkEntryWithTags extends WorkEntry {
  tags?: Tag[];
}
