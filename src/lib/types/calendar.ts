export interface CalendarEvent {
  id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  all_day: boolean;
  color: string;
  recurrence_rule: string | null;
  location: string | null;
  created_by: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalendarEventAttendee {
  event_id: string;
  user_id: string;
  status: "pending" | "accepted" | "declined" | "tentative";
}

export interface BookableResource {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  type: "room" | "equipment" | "person" | "slot";
  availability: Record<string, unknown>;
  created_at: string;
}

export interface Booking {
  id: string;
  resource_id: string;
  workspace_id: string;
  booked_by: string;
  start_time: string;
  end_time: string;
  notes: string | null;
  status: "confirmed" | "cancelled" | "pending";
  created_at: string;
}

export interface Drawing {
  id: string;
  workspace_id: string;
  title: string;
  data: Record<string, unknown>;
  thumbnail_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}
