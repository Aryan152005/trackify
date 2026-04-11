/**
 * Types for advanced visualizations and custom dashboards
 */

export interface KPIMetric {
  label: string;
  value: number;
  formattedValue: string;
  change: number; // percentage change from previous period
  trend: "up" | "down" | "neutral";
  sparkline: number[]; // last 7 data points for mini chart
}

export interface KPIData {
  taskCompletionRate: KPIMetric;
  avgProductivity: KPIMetric;
  activeStreak: KPIMetric;
  totalHours: KPIMetric;
  entriesThisWeek: KPIMetric;
}

export interface HeatmapDay {
  date: string; // yyyy-MM-dd
  count: number;
  level: 0 | 1 | 2 | 3 | 4; // intensity level
}

export interface ActivityHeatmap {
  days: HeatmapDay[];
  maxCount: number;
  totalActivities: number;
  year: number;
}

export interface TeamMemberPerformance {
  userId: string;
  name: string;
  avatarUrl: string | null;
  tasksCompleted: number;
  entriesMade: number;
  hoursLogged: number;
  avgProductivity: number;
}

export type WidgetType =
  | "kpi-cards"
  | "activity-heatmap"
  | "status-donut"
  | "productivity-trend"
  | "team-performance"
  | "recent-activity"
  | "calendar-mini";

export interface DashboardWidget {
  id: string;
  type: WidgetType;
  position: { x: number; y: number };
  size: { w: number; h: number }; // grid columns/rows
  config: Record<string, unknown>;
}

export interface DashboardLayout {
  id: string;
  userId: string;
  workspaceId: string;
  widgets: DashboardWidget[];
  updatedAt: string;
}

export interface StatusDistribution {
  tasks: { status: string; count: number; color: string }[];
  entries: { status: string; count: number; color: string }[];
}

export interface ProductivityTrendPoint {
  date: string;
  label: string;
  productivity: number | null;
  completionRate: number | null;
  entries: number;
}
