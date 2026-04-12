export type ChallengeMode = "habit" | "kanban" | "roadmap";

export interface ChallengeTask { id: string; title: string; done: boolean }
export interface HabitDay { done: boolean; note?: string }
export interface KanbanDay { tasks: ChallengeTask[] }
export interface RoadmapDay { goals: string[]; done: boolean; note?: string }

export type ChallengeDay = HabitDay | KanbanDay | RoadmapDay;

export interface Challenge {
  id: string;
  user_id: string;
  workspace_id: string | null;
  mode: ChallengeMode;
  title: string;
  description: string | null;
  started_at: string;
  duration_days: number;
  days: ChallengeDay[];
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}
