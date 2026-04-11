"use server";

import { createClient } from "@/lib/supabase/server";

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
// Mind Map CRUD
// ---------------------------------------------------------------------------

export async function createMindMap(workspaceId: string, title?: string) {
  const { supabase, user } = await getAuthenticatedUser();

  const defaultNodes = [
    {
      id: "root",
      position: { x: 250, y: 200 },
      data: { label: "Central Idea", color: "#6366f1" },
    },
  ];

  const { data, error } = await supabase
    .from("mindmaps")
    .insert({
      workspace_id: workspaceId,
      title: title ?? "Untitled Mind Map",
      nodes: defaultNodes,
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create mind map: ${error.message}`);
  return data;
}

export async function updateMindMap(
  mindmapId: string,
  data: { title?: string; description?: string }
) {
  const { supabase } = await getAuthenticatedUser();

  const { data: updated, error } = await supabase
    .from("mindmaps")
    .update(data)
    .eq("id", mindmapId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update mind map: ${error.message}`);
  return updated;
}

export async function saveMindMapData(
  mindmapId: string,
  nodes: unknown[],
  edges: unknown[],
  viewport: unknown
) {
  const { supabase } = await getAuthenticatedUser();

  const { data, error } = await supabase
    .from("mindmaps")
    .update({ nodes, edges, viewport })
    .eq("id", mindmapId)
    .select()
    .single();

  if (error)
    throw new Error(`Failed to save mind map data: ${error.message}`);
  return data;
}

export async function deleteMindMap(mindmapId: string) {
  const { supabase } = await getAuthenticatedUser();

  const { error } = await supabase
    .from("mindmaps")
    .delete()
    .eq("id", mindmapId);

  if (error) throw new Error(`Failed to delete mind map: ${error.message}`);
}

export async function getMindMap(mindmapId: string) {
  const { supabase } = await getAuthenticatedUser();

  const { data, error } = await supabase
    .from("mindmaps")
    .select("*")
    .eq("id", mindmapId)
    .single();

  if (error) throw new Error(`Failed to fetch mind map: ${error.message}`);
  return data;
}

export async function listMindMaps(workspaceId: string) {
  const { supabase } = await getAuthenticatedUser();

  const { data, error } = await supabase
    .from("mindmaps")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`Failed to list mind maps: ${error.message}`);
  return data;
}
