"use server";

import { createClient } from "@/lib/supabase/server";
import { createNotification } from "@/lib/notifications/actions";
import type { RequestType, RequestWithProfiles } from "@/lib/types/notification";

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
// Request Actions
// ---------------------------------------------------------------------------

export async function createRequest(data: {
  workspace_id: string;
  to_user_id: string;
  type: RequestType;
  title: string;
  description?: string;
  related_entity_type?: string;
  related_entity_id?: string;
  due_date?: string;
}) {
  const { supabase, user } = await getAuthenticatedUser();

  const { data: request, error } = await supabase
    .from("requests")
    .insert({
      workspace_id: data.workspace_id,
      from_user_id: user.id,
      to_user_id: data.to_user_id,
      type: data.type,
      title: data.title,
      description: data.description ?? null,
      related_entity_type: data.related_entity_type ?? null,
      related_entity_id: data.related_entity_id ?? null,
      due_date: data.due_date ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create request: ${error.message}`);

  // Create a notification for the recipient
  await createNotification({
    workspace_id: data.workspace_id,
    user_id: data.to_user_id,
    type: "request",
    title: `New ${data.type} request: ${data.title}`,
    body: data.description ?? undefined,
    entity_type: "request",
    entity_id: request.id,
  });

  return request;
}

export async function respondToRequest(
  requestId: string,
  status: "accepted" | "declined" | "completed"
) {
  const { supabase, user } = await getAuthenticatedUser();

  // Fetch the request first to get from_user_id and workspace_id
  const { data: existing, error: fetchError } = await supabase
    .from("requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (fetchError || !existing) {
    throw new Error(`Request not found: ${fetchError?.message}`);
  }

  const { data: request, error } = await supabase
    .from("requests")
    .update({
      status,
      responded_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .select()
    .single();

  if (error) throw new Error(`Failed to respond to request: ${error.message}`);

  // Notify the sender about the response
  await createNotification({
    workspace_id: existing.workspace_id,
    user_id: existing.from_user_id,
    type: "request",
    title: `Request "${existing.title}" was ${status}`,
    entity_type: "request",
    entity_id: requestId,
  });

  return request;
}

export async function getReceivedRequests(
  workspaceId: string
): Promise<RequestWithProfiles[]> {
  const { supabase, user } = await getAuthenticatedUser();

  const { data, error } = await supabase
    .from("requests")
    .select(
      "*, from_profile:user_profiles!requests_from_user_id_fkey(name, avatar_url)"
    )
    .eq("workspace_id", workspaceId)
    .eq("to_user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch received requests: ${error.message}`);
  return (data ?? []) as unknown as RequestWithProfiles[];
}

export async function getSentRequests(
  workspaceId: string
): Promise<RequestWithProfiles[]> {
  const { supabase, user } = await getAuthenticatedUser();

  const { data, error } = await supabase
    .from("requests")
    .select(
      "*, to_profile:user_profiles!requests_to_user_id_fkey(name, avatar_url)"
    )
    .eq("workspace_id", workspaceId)
    .eq("from_user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch sent requests: ${error.message}`);
  return (data ?? []) as unknown as RequestWithProfiles[];
}
