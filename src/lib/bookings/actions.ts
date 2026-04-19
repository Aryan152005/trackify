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
// Resource CRUD
// ---------------------------------------------------------------------------

export async function createResource(
  workspaceId: string,
  data: {
    name: string;
    type: string;
    description?: string;
  }
) {
  const { supabase } = await getAuthenticatedUser();

  const { data: resource, error } = await supabase
    .from("bookable_resources")
    .insert({
      workspace_id: workspaceId,
      name: data.name,
      type: data.type,
      description: data.description ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create resource: ${error.message}`);
  revalidatePath("/bookings");
  return resource;
}

export async function deleteResource(resourceId: string) {
  const { supabase, user } = await getAuthenticatedUser();

  // Defense-in-depth: verify caller is admin/owner in the resource's workspace.
  const { data: resource } = await supabase
    .from("bookable_resources")
    .select("workspace_id")
    .eq("id", resourceId)
    .maybeSingle();
  if (!resource) throw new Error("Resource not found");

  const { data: me } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", resource.workspace_id as string)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!me || (me.role !== "owner" && me.role !== "admin")) {
    throw new Error("Only workspace admins can delete resources");
  }

  const { error } = await supabase
    .from("bookable_resources")
    .delete()
    .eq("id", resourceId);

  if (error) throw new Error(`Failed to delete resource: ${error.message}`);
  revalidatePath("/bookings");
}

export async function getResources(workspaceId: string) {
  const { supabase } = await getAuthenticatedUser();

  const { data: resources, error } = await supabase
    .from("bookable_resources")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("name", { ascending: true });

  if (error) throw new Error(`Failed to fetch resources: ${error.message}`);
  return resources;
}

// ---------------------------------------------------------------------------
// Booking CRUD
// ---------------------------------------------------------------------------

export async function createBooking(data: {
  resource_id: string;
  workspace_id: string;
  start_time: string;
  end_time: string;
  notes?: string;
}) {
  const { supabase, user } = await getAuthenticatedUser();

  const { data: booking, error } = await supabase
    .from("bookings")
    .insert({
      resource_id: data.resource_id,
      workspace_id: data.workspace_id,
      booked_by: user.id,
      start_time: data.start_time,
      end_time: data.end_time,
      notes: data.notes ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create booking: ${error.message}`);
  revalidatePath("/bookings");
  return booking;
}

export async function cancelBooking(bookingId: string) {
  const { supabase, user } = await getAuthenticatedUser();

  // Only the booker (or a workspace admin) can cancel.
  const { data: existing } = await supabase
    .from("bookings")
    .select("booked_by, workspace_id")
    .eq("id", bookingId)
    .maybeSingle();
  if (!existing) throw new Error("Booking not found");

  if (existing.booked_by !== user.id) {
    const { data: me } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", existing.workspace_id as string)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!me || (me.role !== "owner" && me.role !== "admin")) {
      throw new Error("Only the booker or a workspace admin can cancel this booking");
    }
  }

  const { data: booking, error } = await supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", bookingId)
    .select()
    .single();

  if (error) throw new Error(`Failed to cancel booking: ${error.message}`);
  revalidatePath("/bookings");
  return booking;
}

/**
 * Edit a booking's notes. Date/time edits are intentionally not supported
 * here — changing a booking's window requires a conflict-check pass, which
 * is safer done by cancelling + re-booking.
 */
export async function updateBookingNotes(bookingId: string, notes: string | null) {
  const { supabase, user } = await getAuthenticatedUser();

  const { data: existing } = await supabase
    .from("bookings")
    .select("booked_by, workspace_id")
    .eq("id", bookingId)
    .maybeSingle();
  if (!existing) throw new Error("Booking not found");

  if (existing.booked_by !== user.id) {
    const { data: me } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", existing.workspace_id as string)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!me || (me.role !== "owner" && me.role !== "admin")) {
      throw new Error("Only the booker or a workspace admin can edit this booking");
    }
  }

  const { error } = await supabase
    .from("bookings")
    .update({ notes: notes?.trim() || null })
    .eq("id", bookingId);
  if (error) throw new Error(`Failed to update booking: ${error.message}`);
  revalidatePath("/bookings");
}

export async function getBookings(
  workspaceId: string,
  startDate?: string,
  endDate?: string
) {
  const { supabase } = await getAuthenticatedUser();

  let query = supabase
    .from("bookings")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("start_time", { ascending: true });

  if (startDate) {
    query = query.gte("start_time", startDate);
  }
  if (endDate) {
    query = query.lte("end_time", endDate);
  }

  const { data: bookings, error } = await query;

  if (error) throw new Error(`Failed to fetch bookings: ${error.message}`);
  return bookings;
}
