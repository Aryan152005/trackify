"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
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
// Board CRUD
// ---------------------------------------------------------------------------

export async function createBoard(
  workspaceId: string,
  name: string,
  description?: string
) {
  const { supabase, user } = await getAuthenticatedUser();

  const { data: board, error } = await supabase
    .from("boards")
    .insert({
      workspace_id: workspaceId,
      name,
      description: description ?? null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create board: ${error.message}`);

  // Create 3 default columns
  const defaultColumns = [
    { board_id: board.id, name: "To Do", color: "#6366f1", position: 0 },
    { board_id: board.id, name: "In Progress", color: "#f59e0b", position: 1 },
    { board_id: board.id, name: "Done", color: "#10b981", position: 2 },
  ];

  const { error: colError } = await supabase
    .from("board_columns")
    .insert(defaultColumns);

  if (colError)
    throw new Error(`Failed to create default columns: ${colError.message}`);

  await logActivity({
    workspaceId,
    action: "created",
    entityType: "board",
    entityId: board.id as string,
    entityTitle: (board.name as string) ?? "Untitled Board",
  });
  revalidatePath("/boards");
  return board;
}

export async function updateBoard(
  boardId: string,
  data: { name?: string; description?: string }
) {
  const { supabase } = await getAuthenticatedUser();

  const { data: board, error } = await supabase
    .from("boards")
    .update(data)
    .eq("id", boardId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update board: ${error.message}`);
  revalidatePath("/boards");
  revalidatePath(`/boards/${boardId}`);
  if (data.name) {
    await logActivity({
      workspaceId: (board.workspace_id as string) ?? null,
      action: "renamed",
      entityType: "board",
      entityId: boardId,
      entityTitle: data.name,
    });
  }
  return board;
}

export async function deleteBoard(boardId: string) {
  const { supabase } = await getAuthenticatedUser();

  const { data: existing } = await supabase
    .from("boards")
    .select("workspace_id, name")
    .eq("id", boardId)
    .maybeSingle();

  const { error } = await supabase.from("boards").delete().eq("id", boardId);
  if (error) throw new Error(`Failed to delete board: ${error.message}`);

  if (existing) {
    await logActivity({
      workspaceId: (existing.workspace_id as string) ?? null,
      action: "deleted",
      entityType: "board",
      entityId: boardId,
      entityTitle: (existing.name as string) ?? "Untitled Board",
    });
  }
  revalidatePath("/boards");
}

// ---------------------------------------------------------------------------
// Column CRUD
// ---------------------------------------------------------------------------

export async function createColumn(
  boardId: string,
  name: string,
  color?: string
) {
  const { supabase } = await getAuthenticatedUser();

  // Find the current max position
  const { data: existing, error: fetchError } = await supabase
    .from("board_columns")
    .select("position")
    .eq("board_id", boardId)
    .order("position", { ascending: false })
    .limit(1);

  if (fetchError)
    throw new Error(`Failed to fetch columns: ${fetchError.message}`);

  const nextPosition =
    existing && existing.length > 0 ? existing[0].position + 1 : 0;

  const { data: column, error } = await supabase
    .from("board_columns")
    .insert({
      board_id: boardId,
      name,
      color: color ?? "#6366f1",
      position: nextPosition,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create column: ${error.message}`);
  return column;
}

export async function updateColumn(
  columnId: string,
  data: { name?: string; color?: string }
) {
  const { supabase } = await getAuthenticatedUser();

  const { data: column, error } = await supabase
    .from("board_columns")
    .update(data)
    .eq("id", columnId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update column: ${error.message}`);
  return column;
}

export async function deleteColumn(columnId: string) {
  const { supabase } = await getAuthenticatedUser();

  const { error } = await supabase
    .from("board_columns")
    .delete()
    .eq("id", columnId);

  if (error) throw new Error(`Failed to delete column: ${error.message}`);
}

export async function reorderColumns(boardId: string, columnIds: string[]) {
  const { supabase } = await getAuthenticatedUser();

  // Update each column's position based on its index in the array
  const updates = columnIds.map((id, index) =>
    supabase
      .from("board_columns")
      .update({ position: index })
      .eq("id", id)
      .eq("board_id", boardId)
  );

  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error)
    throw new Error(`Failed to reorder columns: ${failed.error.message}`);
}

// ---------------------------------------------------------------------------
// Task ↔ Board operations
// ---------------------------------------------------------------------------

export async function moveTask(
  taskId: string,
  targetColumnId: string,
  newPosition: number
) {
  const { supabase } = await getAuthenticatedUser();

  // Get the target column's board_id
  const { data: column, error: colError } = await supabase
    .from("board_columns")
    .select("board_id")
    .eq("id", targetColumnId)
    .single();

  if (colError || !column)
    throw new Error(`Target column not found: ${colError?.message}`);

  // Get tasks currently in the target column, ordered by position
  const { data: columnTasks, error: fetchError } = await supabase
    .from("tasks")
    .select("id, position")
    .eq("column_id", targetColumnId)
    .neq("id", taskId)
    .order("position", { ascending: true });

  if (fetchError)
    throw new Error(`Failed to fetch column tasks: ${fetchError.message}`);

  // Recalculate positions: insert the moved task at newPosition
  const reordered = columnTasks ?? [];

  // Assign positions: items before newPosition keep their sequential index,
  // items at or after shift down by 1.
  let pos = 0;
  for (let i = 0; i < reordered.length; i++) {
    if (pos === newPosition) pos++; // leave a gap for the moved task
    await supabase
      .from("tasks")
      .update({ position: pos })
      .eq("id", reordered[i].id);
    pos++;
  }

  // Update the moved task itself
  await supabase
    .from("tasks")
    .update({
      column_id: targetColumnId,
      board_id: column.board_id,
      position: newPosition,
    })
    .eq("id", taskId);
}

export async function addTaskToBoard(
  boardId: string,
  columnId: string,
  taskData: {
    title: string;
    description?: string;
    priority?: string;
    assigned_to?: string;
    due_date?: string;
  }
) {
  const { supabase, user } = await getAuthenticatedUser();

  // Get workspace_id from the board
  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("workspace_id")
    .eq("id", boardId)
    .single();

  if (boardError || !board)
    throw new Error(`Board not found: ${boardError?.message}`);

  // Find the max position in the target column
  const { data: existing, error: fetchError } = await supabase
    .from("tasks")
    .select("position")
    .eq("column_id", columnId)
    .order("position", { ascending: false })
    .limit(1);

  if (fetchError)
    throw new Error(`Failed to fetch tasks: ${fetchError.message}`);

  const nextPosition =
    existing && existing.length > 0 ? existing[0].position + 1 : 0;

  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      user_id: user.id,
      workspace_id: board.workspace_id,
      board_id: boardId,
      column_id: columnId,
      position: nextPosition,
      title: taskData.title,
      description: taskData.description ?? null,
      priority: taskData.priority ?? "medium",
      assigned_to: taskData.assigned_to ?? null,
      due_date: taskData.due_date ?? null,
      status: "pending",
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create task: ${error.message}`);
  return task;
}

export async function removeTaskFromBoard(taskId: string) {
  const { supabase } = await getAuthenticatedUser();

  const { error } = await supabase
    .from("tasks")
    .update({ board_id: null, column_id: null, position: null })
    .eq("id", taskId);

  if (error)
    throw new Error(`Failed to remove task from board: ${error.message}`);
}

export async function assignTask(taskId: string, userId: string | null) {
  const { supabase } = await getAuthenticatedUser();

  const { error } = await supabase
    .from("tasks")
    .update({ assigned_to: userId })
    .eq("id", taskId);

  if (error) throw new Error(`Failed to assign task: ${error.message}`);
}
