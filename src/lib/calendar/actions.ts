"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error("Not authenticated");
  }
  return { supabase, user };
}

// ---------------------------------------------------------------------------
// Calendar Event CRUD
// ---------------------------------------------------------------------------

export async function createEvent(
  workspaceId: string,
  data: {
    title: string;
    start_time: string;
    end_time: string;
    all_day?: boolean;
    color?: string;
    location?: string;
    description?: string;
  }
) {
  const { supabase, user } = await getAuthenticatedUser();

  const { data: event, error } = await supabase
    .from("calendar_events")
    .insert({
      workspace_id: workspaceId,
      title: data.title,
      start_time: data.start_time,
      end_time: data.end_time,
      all_day: data.all_day ?? false,
      color: data.color ?? "#6366f1",
      location: data.location ?? null,
      description: data.description ?? null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create event: ${error.message}`);
  revalidatePath("/calendar");
  return event;
}

export async function updateEvent(
  eventId: string,
  data: {
    title?: string;
    start_time?: string;
    end_time?: string;
    all_day?: boolean;
    color?: string;
    location?: string;
    description?: string;
    recurrence_rule?: string;
  }
) {
  const { supabase } = await getAuthenticatedUser();

  const { data: event, error } = await supabase
    .from("calendar_events")
    .update(data)
    .eq("id", eventId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update event: ${error.message}`);
  revalidatePath("/calendar");
  return event;
}

export async function deleteEvent(eventId: string) {
  const { supabase } = await getAuthenticatedUser();

  const { error } = await supabase
    .from("calendar_events")
    .delete()
    .eq("id", eventId);

  if (error) throw new Error(`Failed to delete event: ${error.message}`);
  revalidatePath("/calendar");
}

export async function getEvents(
  workspaceId: string,
  startDate: string,
  endDate: string
) {
  const { supabase } = await getAuthenticatedUser();

  const { data: events, error } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("workspace_id", workspaceId)
    .gte("start_time", startDate)
    .lte("end_time", endDate)
    .order("start_time", { ascending: true });

  if (error) throw new Error(`Failed to fetch events: ${error.message}`);
  return events;
}

// ---------------------------------------------------------------------------
// Aggregated calendar: events + tasks with due_date + reminders
// ---------------------------------------------------------------------------

export async function getAggregatedCalendar(
  workspaceId: string,
  startDate: string,
  endDate: string
) {
  const { supabase } = await getAuthenticatedUser();

  // Fetch calendar events
  const { data: events, error: eventsError } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("workspace_id", workspaceId)
    .gte("start_time", startDate)
    .lte("end_time", endDate)
    .order("start_time", { ascending: true });

  if (eventsError)
    throw new Error(`Failed to fetch events: ${eventsError.message}`);

  // Fetch tasks with due_date in range
  const { data: tasks, error: tasksError } = await supabase
    .from("tasks")
    .select("id, title, due_date, status, priority")
    .eq("workspace_id", workspaceId)
    .gte("due_date", startDate)
    .lte("due_date", endDate)
    .order("due_date", { ascending: true });

  if (tasksError)
    throw new Error(`Failed to fetch tasks: ${tasksError.message}`);

  // Fetch reminders in range
  const { data: reminders, error: remindersError } = await supabase
    .from("reminders")
    .select("id, title, reminder_time")
    .eq("workspace_id", workspaceId)
    .gte("reminder_time", startDate)
    .lte("reminder_time", endDate)
    .order("reminder_time", { ascending: true });

  if (remindersError)
    throw new Error(`Failed to fetch reminders: ${remindersError.message}`);

  // Build unified array
  const unified = [
    ...(events ?? []).map((e) => ({
      type: "event" as const,
      id: e.id,
      title: e.title,
      start_time: e.start_time,
      end_time: e.end_time,
      all_day: e.all_day,
      color: e.color,
    })),
    ...(tasks ?? []).map((t) => ({
      type: "task" as const,
      id: t.id,
      title: t.title,
      start_time: t.due_date,
      end_time: t.due_date,
      all_day: true,
      color: t.priority === "high" ? "#ef4444" : "#f59e0b",
    })),
    ...(reminders ?? []).map((r) => ({
      type: "reminder" as const,
      id: r.id,
      title: r.title,
      start_time: r.reminder_time,
      end_time: r.reminder_time,
      all_day: false,
      color: "#8b5cf6",
    })),
  ];

  unified.sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  return unified;
}
