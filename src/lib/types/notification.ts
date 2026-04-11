export type NotificationType =
  | "mention"
  | "assignment"
  | "reminder"
  | "request"
  | "nudge"
  | "comment";

export type RequestType =
  | "task"
  | "review"
  | "approval"
  | "info"
  | "nudge"
  | "custom";

export type RequestStatus = "pending" | "accepted" | "declined" | "completed";

export interface Notification {
  id: string;
  workspace_id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface Request {
  id: string;
  workspace_id: string;
  from_user_id: string;
  to_user_id: string;
  type: RequestType;
  title: string;
  description: string | null;
  status: RequestStatus;
  related_entity_type: string | null;
  related_entity_id: string | null;
  due_date: string | null;
  responded_at: string | null;
  created_at: string;
}

export interface RequestWithProfiles extends Request {
  from_profile?: { name: string; avatar_url: string | null };
  to_profile?: { name: string; avatar_url: string | null };
}

export interface DiscordWebhook {
  id: string;
  workspace_id: string;
  name: string;
  webhook_url: string;
  events: string[];
  is_active: boolean;
  created_by: string;
  created_at: string;
}
