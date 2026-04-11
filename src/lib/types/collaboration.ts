/**
 * Collaboration types for Trackify (Work Intelligence System).
 * Match the schema in supabase/migrations/013_collaboration.sql
 */

export type EntityType = 'page' | 'task' | 'board' | 'entry' | 'drawing' | 'mindmap';

export type SharedLinkPermission = 'view' | 'comment' | 'edit';

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export interface Comment {
  id: string;
  workspace_id: string;
  user_id: string;
  entity_type: EntityType;
  entity_id: string;
  parent_comment_id: string | null;
  content: string;
  resolved: boolean;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommentWithAuthor extends Comment {
  user_profile: {
    name: string;
    avatar_url: string | null;
  };
  resolved_by_profile?: {
    name: string;
    avatar_url: string | null;
  } | null;
}

export interface CommentThread extends CommentWithAuthor {
  replies: CommentWithAuthor[];
}

// ---------------------------------------------------------------------------
// Mentions
// ---------------------------------------------------------------------------

export interface Mention {
  id: string;
  workspace_id: string;
  comment_id: string | null;
  entity_type: EntityType;
  entity_id: string;
  mentioned_user_id: string;
  mentioned_by: string;
  seen: boolean;
  created_at: string;
}

export interface MentionWithDetails extends Mention {
  mentioned_user_profile: {
    name: string;
    avatar_url: string | null;
  };
  mentioned_by_profile: {
    name: string;
    avatar_url: string | null;
  };
  comment?: {
    id: string;
    content: string;
  } | null;
}

// ---------------------------------------------------------------------------
// Shared Links
// ---------------------------------------------------------------------------

export interface SharedLink {
  id: string;
  workspace_id: string;
  entity_type: EntityType;
  entity_id: string;
  created_by: string;
  token: string;
  permission: SharedLinkPermission;
  password_hash: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Cursor Positions
// ---------------------------------------------------------------------------

export interface CursorData {
  x?: number;
  y?: number;
  selection?: {
    anchor: number;
    head: number;
  };
  blockId?: string;
  color?: string;
  name?: string;
  [key: string]: unknown;
}

export interface CursorPosition {
  id: string;
  workspace_id: string;
  user_id: string;
  entity_type: EntityType;
  entity_id: string;
  cursor_data: CursorData;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Insert types (for creating new records)
// ---------------------------------------------------------------------------

export interface CommentInsert {
  workspace_id: string;
  user_id: string;
  entity_type: EntityType;
  entity_id: string;
  parent_comment_id?: string | null;
  content: string;
}

export interface MentionInsert {
  workspace_id: string;
  comment_id?: string | null;
  entity_type: EntityType;
  entity_id: string;
  mentioned_user_id: string;
  mentioned_by: string;
}

export interface SharedLinkInsert {
  workspace_id: string;
  entity_type: EntityType;
  entity_id: string;
  created_by: string;
  permission?: SharedLinkPermission;
  password_hash?: string | null;
  expires_at?: string | null;
}

export interface CursorPositionUpsert {
  workspace_id: string;
  user_id: string;
  entity_type: EntityType;
  entity_id: string;
  cursor_data: CursorData;
}
