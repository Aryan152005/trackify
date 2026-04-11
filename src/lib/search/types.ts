export type SearchResultType =
  | "page"
  | "task"
  | "entry"
  | "board"
  | "mindmap"
  | "calendar_event"
  | "reminder"
  | "comment";

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle?: string;
  url: string;
  icon: string; // lucide icon name
  updatedAt: string;
  highlight?: string; // matched text snippet
}

export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  shortcut?: string;
  action: string; // route to navigate or action identifier
  category: "create" | "navigate" | "settings";
}

export interface SearchFilters {
  types?: SearchResultType[];
  limit?: number;
}
