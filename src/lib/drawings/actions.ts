"use server";

import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity/actions";

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
// Drawing CRUD
// ---------------------------------------------------------------------------

export async function createDrawing(workspaceId: string, title?: string) {
  const { supabase, user } = await getAuthenticatedUser();

  const { data: drawing, error } = await supabase
    .from("drawings")
    .insert({
      workspace_id: workspaceId,
      title: title ?? "Untitled Drawing",
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create drawing: ${error.message}`);
  await logActivity({
    workspaceId,
    action: "created",
    entityType: "drawing",
    entityId: drawing.id as string,
    entityTitle: (drawing.title as string) ?? "Untitled Drawing",
  });
  return drawing;
}

export async function saveDrawingData(
  drawingId: string,
  data: Record<string, unknown>
) {
  const { supabase } = await getAuthenticatedUser();

  const { data: drawing, error } = await supabase
    .from("drawings")
    .update({ data })
    .eq("id", drawingId)
    .select()
    .single();

  if (error)
    throw new Error(`Failed to save drawing data: ${error.message}`);
  return drawing;
}

export async function updateDrawing(
  drawingId: string,
  data: { title?: string }
) {
  const { supabase } = await getAuthenticatedUser();

  const { data: drawing, error } = await supabase
    .from("drawings")
    .update(data)
    .eq("id", drawingId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update drawing: ${error.message}`);
  return drawing;
}

export async function deleteDrawing(drawingId: string) {
  const { supabase } = await getAuthenticatedUser();

  const { data: existing } = await supabase
    .from("drawings")
    .select("workspace_id, title")
    .eq("id", drawingId)
    .maybeSingle();

  const { error } = await supabase
    .from("drawings")
    .delete()
    .eq("id", drawingId);

  if (error) throw new Error(`Failed to delete drawing: ${error.message}`);
  if (existing) {
    await logActivity({
      workspaceId: (existing.workspace_id as string) ?? null,
      action: "deleted",
      entityType: "drawing",
      entityId: drawingId,
      entityTitle: (existing.title as string) ?? "Untitled Drawing",
    });
  }
}

export async function listDrawings(workspaceId: string) {
  const { supabase } = await getAuthenticatedUser();

  const { data: drawings, error } = await supabase
    .from("drawings")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch drawings: ${error.message}`);
  return drawings;
}
