export interface PersonalDashboardConfig {
  /** Which widgets are visible on the personal dashboard */
  visibleSections: {
    pages: boolean;
    tasks: boolean;
    entries: boolean;
    boards: boolean;
    reminders: boolean;
  };
  /** Widget order (array of section keys) */
  widgetOrder: string[];
  /** Whether to show the recent items feed */
  showRecentFeed: boolean;
}

export interface PersonalStats {
  privatePages: number;
  privateTasks: {
    total: number;
    pending: number;
    inProgress: number;
    done: number;
  };
  privateEntries: number;
  privateBoards: number;
  privateReminders: number;
}

export const DEFAULT_DASHBOARD_CONFIG: PersonalDashboardConfig = {
  visibleSections: {
    pages: true,
    tasks: true,
    entries: true,
    boards: true,
    reminders: true,
  },
  widgetOrder: ["pages", "tasks", "entries", "boards", "reminders"],
  showRecentFeed: true,
};
