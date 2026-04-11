export interface Page {
  id: string;
  workspace_id: string;
  parent_page_id: string | null;
  title: string;
  icon: string | null;
  cover_url: string | null;
  content: unknown[];
  created_by: string;
  last_edited_by: string | null;
  is_template: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface PageTreeItem {
  id: string;
  title: string;
  icon: string | null;
  parent_page_id: string | null;
  children: PageTreeItem[];
}
