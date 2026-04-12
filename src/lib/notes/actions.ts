"use server";

import { createClient } from "@/lib/supabase/server";
import type { Page } from "@/lib/types/page";

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
// Page CRUD
// ---------------------------------------------------------------------------

export async function createPage(
  workspaceId: string,
  title?: string,
  parentPageId?: string
): Promise<Page> {
  const { supabase, user } = await getAuthenticatedUser();

  const { data, error } = await supabase
    .from("pages")
    .insert({
      workspace_id: workspaceId,
      title: title ?? "Untitled",
      parent_page_id: parentPageId ?? null,
      created_by: user.id,
      last_edited_by: user.id,
      content: [],
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create page: ${error.message}`);
  return data as Page;
}

export async function updatePageContent(
  pageId: string,
  content: unknown[]
): Promise<Page> {
  const { supabase, user } = await getAuthenticatedUser();

  const { data, error } = await supabase
    .from("pages")
    .update({
      content,
      last_edited_by: user.id,
    })
    .eq("id", pageId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update page content: ${error.message}`);

  // Log to activity_log (best-effort, never fails the save)
  try {
    await supabase.from("activity_log").insert({
      workspace_id: data.workspace_id,
      user_id: user.id,
      action: "edited",
      entity_type: "page",
      entity_id: pageId,
      entity_title: data.title ?? "Untitled",
    });
  } catch { /* silent */ }

  return data as Page;
}

export async function updatePageTitle(
  pageId: string,
  title: string
): Promise<Page> {
  const { supabase, user } = await getAuthenticatedUser();

  const { data, error } = await supabase
    .from("pages")
    .update({
      title,
      last_edited_by: user.id,
    })
    .eq("id", pageId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update page title: ${error.message}`);

  try {
    await supabase.from("activity_log").insert({
      workspace_id: data.workspace_id,
      user_id: user.id,
      action: "renamed",
      entity_type: "page",
      entity_id: pageId,
      entity_title: title,
    });
  } catch { /* silent */ }

  return data as Page;
}

export async function updatePageMeta(
  pageId: string,
  meta: { icon?: string; cover_url?: string }
): Promise<Page> {
  const { supabase, user } = await getAuthenticatedUser();

  const updates: Record<string, unknown> = { last_edited_by: user.id };
  if (meta.icon !== undefined) updates.icon = meta.icon;
  if (meta.cover_url !== undefined) updates.cover_url = meta.cover_url;

  const { data, error } = await supabase
    .from("pages")
    .update(updates)
    .eq("id", pageId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update page meta: ${error.message}`);
  return data as Page;
}

// ---------------------------------------------------------------------------
// Archive / Restore / Delete
// ---------------------------------------------------------------------------

export async function archivePage(pageId: string): Promise<void> {
  const { supabase } = await getAuthenticatedUser();

  const { error } = await supabase
    .from("pages")
    .update({ is_archived: true })
    .eq("id", pageId);

  if (error) throw new Error(`Failed to archive page: ${error.message}`);
}

export async function restorePage(pageId: string): Promise<void> {
  const { supabase } = await getAuthenticatedUser();

  const { error } = await supabase
    .from("pages")
    .update({ is_archived: false })
    .eq("id", pageId);

  if (error) throw new Error(`Failed to restore page: ${error.message}`);
}

export async function deletePage(pageId: string): Promise<void> {
  const { supabase } = await getAuthenticatedUser();

  const { error } = await supabase
    .from("pages")
    .delete()
    .eq("id", pageId);

  if (error) throw new Error(`Failed to delete page: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Move & Tree
// ---------------------------------------------------------------------------

export async function movePage(
  pageId: string,
  newParentId: string | null
): Promise<void> {
  const { supabase } = await getAuthenticatedUser();

  const { error } = await supabase
    .from("pages")
    .update({ parent_page_id: newParentId })
    .eq("id", pageId);

  if (error) throw new Error(`Failed to move page: ${error.message}`);
}

export async function getPageTree(
  workspaceId: string
): Promise<Pick<Page, "id" | "title" | "icon" | "parent_page_id">[]> {
  const { supabase } = await getAuthenticatedUser();

  const { data, error } = await supabase
    .from("pages")
    .select("id, title, icon, parent_page_id")
    .eq("workspace_id", workspaceId)
    .eq("is_archived", false)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to fetch page tree: ${error.message}`);
  return data as Pick<Page, "id" | "title" | "icon" | "parent_page_id">[];
}

// ---------------------------------------------------------------------------
// Create from template
// ---------------------------------------------------------------------------

/**
 * Clone a template page into a new regular page (is_template=false) in the
 * given workspace. Copies content, icon, and cover but not the template flag.
 */
export async function createPageFromTemplate(
  templateId: string,
  workspaceId: string,
  title?: string,
  parentPageId?: string
): Promise<Page> {
  const { supabase, user } = await getAuthenticatedUser();

  const { data: template, error: fetchError } = await supabase
    .from("pages")
    .select("*")
    .eq("id", templateId)
    .eq("is_template", true)
    .single();

  if (fetchError || !template)
    throw new Error(`Template not found: ${fetchError?.message ?? "unknown"}`);

  const { data, error } = await supabase
    .from("pages")
    .insert({
      workspace_id: workspaceId,
      parent_page_id: parentPageId ?? null,
      title: title ?? template.title,
      icon: template.icon,
      cover_url: template.cover_url,
      content: template.content,
      is_template: false,
      created_by: user.id,
      last_edited_by: user.id,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create page from template: ${error.message}`);
  return data as Page;
}

// ---------------------------------------------------------------------------
// Duplicate
// ---------------------------------------------------------------------------

export async function duplicatePage(pageId: string): Promise<Page> {
  const { supabase, user } = await getAuthenticatedUser();

  // Fetch the original page
  const { data: original, error: fetchError } = await supabase
    .from("pages")
    .select("*")
    .eq("id", pageId)
    .single();

  if (fetchError || !original)
    throw new Error(`Failed to fetch page for duplication: ${fetchError?.message}`);

  const { data, error } = await supabase
    .from("pages")
    .insert({
      workspace_id: original.workspace_id,
      parent_page_id: null,
      title: `Copy of ${original.title}`,
      icon: original.icon,
      cover_url: original.cover_url,
      content: original.content,
      created_by: user.id,
      last_edited_by: user.id,
      is_template: original.is_template,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to duplicate page: ${error.message}`);
  return data as Page;
}
