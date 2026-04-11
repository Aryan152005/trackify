export interface Board {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  created_by: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface BoardColumn {
  id: string;
  board_id: string;
  name: string;
  color: string;
  position: number;
  created_at: string;
}

export interface BoardColumnWithTasks extends BoardColumn {
  tasks: TaskCard[];
}

export interface TaskCard {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  assigned_to: string | null;
  labels: Label[];
  position: number;
  column_id: string | null;
  assigned_profile?: {
    name: string;
    avatar_url: string | null;
  } | null;
}

export interface Label {
  name: string;
  color: string;
}
