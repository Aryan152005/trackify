export interface MindMap {
  id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  nodes: MindMapNode[];
  edges: MindMapEdge[];
  viewport: { x: number; y: number; zoom: number };
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface MindMapNode {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: {
    label: string;
    color?: string;
    description?: string;
  };
}

export interface MindMapEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  animated?: boolean;
  style?: Record<string, unknown>;
}

export interface ActivityLogEntry {
  id: string;
  workspace_id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  entity_title: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}
