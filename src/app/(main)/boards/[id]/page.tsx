"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { createClient } from "@/lib/supabase/client";
import { useWorkspaceId } from "@/lib/workspace/hooks";
import { toast } from "sonner";
import {
  moveTask,
  addTaskToBoard,
  createColumn,
  updateColumn as updateColumnAction,
  deleteColumn as deleteColumnAction,
  reorderColumns,
} from "@/lib/boards/actions";
import { AnimatedPage } from "@/components/ui/animated-layout";
import { CollaborationToolbar } from "@/components/collaboration/collaboration-toolbar";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { KanbanColumn, KanbanColumnOverlay } from "@/components/boards/kanban-column";
import { KanbanCardOverlay } from "@/components/boards/kanban-card";
import { TaskDetailModal } from "@/components/boards/task-detail-modal";
import {
  Plus,
  Loader2,
} from "lucide-react";
import type {
  Board,
  BoardColumn,
  BoardColumnWithTasks,
  TaskCard,
} from "@/lib/types/board";

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function BoardDetailPage() {
  const params = useParams();
  const router = useRouter();
  const boardId = params.id as string;
  const workspaceId = useWorkspaceId();

  const [board, setBoard] = useState<Board | null>(null);
  const [columns, setColumns] = useState<BoardColumnWithTasks[]>([]);
  const [members, setMembers] = useState<
    { id: string; name: string; avatar_url: string | null }[]
  >([]);
  const [loading, setLoading] = useState(true);

  // Drag state
  const [activeTask, setActiveTask] = useState<TaskCard | null>(null);
  const [activeColumn, setActiveColumn] = useState<BoardColumnWithTasks | null>(
    null
  );

  // Add task inline state
  const [addingToColumn, setAddingToColumn] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [addingTask, setAddingTask] = useState(false);

  // Add column state
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [addingColumn, setAddingColumn] = useState(false);

  // Task detail modal
  const [selectedTask, setSelectedTask] = useState<TaskCard | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // -------------------------------------------------------------------------
  // Fetch data
  // -------------------------------------------------------------------------

  const fetchBoard = useCallback(async () => {
    const supabase = createClient();

    const [boardRes, columnsRes, tasksRes] = await Promise.all([
      supabase.from("boards").select("*").eq("id", boardId).single(),
      supabase
        .from("board_columns")
        .select("*")
        .eq("board_id", boardId)
        .order("position"),
      supabase
        .from("tasks")
        .select(
          "id, title, description, status, priority, due_date, assigned_to, labels, position, column_id"
        )
        .eq("board_id", boardId)
        .order("position"),
    ]);

    if (boardRes.error || !boardRes.data) {
      router.push("/boards");
      return;
    }

    setBoard(boardRes.data as Board);

    // Fetch assignee profiles in a second query (FK is on auth.users, not user_profiles)
    const rawTasksInit = (tasksRes.data ?? []) as Array<Record<string, unknown>>;
    const assigneeIds = [...new Set(rawTasksInit.map((t) => t.assigned_to).filter(Boolean))] as string[];
    const profileMap = new Map<string, { name: string; avatar_url: string | null }>();
    if (assigneeIds.length > 0) {
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("user_id, name, avatar_url")
        .in("user_id", assigneeIds);
      for (const p of profiles ?? []) {
        profileMap.set(p.user_id as string, {
          name: (p.name as string) ?? "",
          avatar_url: (p.avatar_url as string) ?? null,
        });
      }
    }

    // Build a map of tasks per column
    const tasksByColumn = new Map<string, TaskCard[]>();
    const rawTasks = rawTasksInit as Array<Record<string, unknown>>;

    for (const t of rawTasks) {
      const colId = t.column_id as string | null;
      if (!colId) continue;

      const card: TaskCard = {
        id: t.id as string,
        title: t.title as string,
        description: (t.description as string) ?? null,
        status: t.status as string,
        priority: t.priority as string,
        due_date: (t.due_date as string) ?? null,
        assigned_to: (t.assigned_to as string) ?? null,
        labels: (t.labels as TaskCard["labels"]) ?? [],
        position: t.position as number,
        column_id: colId,
        assigned_profile: t.assigned_to ? profileMap.get(t.assigned_to as string) ?? null : null,
      };

      if (!tasksByColumn.has(colId)) tasksByColumn.set(colId, []);
      tasksByColumn.get(colId)!.push(card);
    }

    const cols: BoardColumnWithTasks[] = (
      (columnsRes.data ?? []) as BoardColumn[]
    ).map((col) => ({
      ...col,
      tasks: tasksByColumn.get(col.id) ?? [],
    }));

    setColumns(cols);
    setLoading(false);
  }, [boardId, router]);

  const fetchMembers = useCallback(async () => {
    if (!workspaceId) return;
    const supabase = createClient();
    const { data: memberRows } = await supabase
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", workspaceId);

    const userIds = (memberRows ?? []).map((m) => m.user_id as string);
    if (userIds.length === 0) {
      setMembers([]);
      return;
    }
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("user_id, name, avatar_url")
      .in("user_id", userIds);

    const mapped = (profiles ?? []).map((p) => ({
      id: p.user_id as string,
      name: (p.name as string) ?? "",
      avatar_url: (p.avatar_url as string) ?? null,
    }));
    setMembers(mapped);
  }, [workspaceId]);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // Live updates: any insert/update/delete on board_columns or tasks
  // belonging to this board triggers a re-fetch so peers see each other's moves.
  useEffect(() => {
    if (!boardId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`board-${boardId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "board_columns", filter: `board_id=eq.${boardId}` },
        () => { fetchBoard(); }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `board_id=eq.${boardId}` },
        () => { fetchBoard(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [boardId, fetchBoard]);

  // -------------------------------------------------------------------------
  // DnD sensors
  // -------------------------------------------------------------------------

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const columnIds = useMemo(() => columns.map((c) => c.id), [columns]);

  // -------------------------------------------------------------------------
  // DnD handlers
  // -------------------------------------------------------------------------

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    const data = active.data.current;
    if (data?.type === "task") {
      setActiveTask(data.task as TaskCard);
    } else if (data?.type === "column") {
      setActiveColumn(data.column as BoardColumnWithTasks);
    }
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current;
    if (activeData?.type !== "task") return;

    const task = activeData.task as TaskCard;

    // Determine target column
    let targetColumnId: string | null = null;
    const overData = over.data.current;

    if (overData?.type === "task") {
      targetColumnId = (overData.task as TaskCard).column_id;
    } else if (overData?.type === "column") {
      targetColumnId = (overData.column as BoardColumnWithTasks).id;
    } else if (typeof over.id === "string" && over.id.startsWith("column-droppable-")) {
      targetColumnId = over.id.replace("column-droppable-", "");
    }

    if (!targetColumnId || targetColumnId === task.column_id) return;

    // Move task between columns optimistically
    setColumns((prev) => {
      const sourceColIdx = prev.findIndex((c) => c.id === task.column_id);
      const targetColIdx = prev.findIndex((c) => c.id === targetColumnId);
      if (sourceColIdx === -1 || targetColIdx === -1) return prev;

      const updated = [...prev];
      const sourceCol = { ...updated[sourceColIdx], tasks: [...updated[sourceColIdx].tasks] };
      const targetCol = { ...updated[targetColIdx], tasks: [...updated[targetColIdx].tasks] };

      const taskIdx = sourceCol.tasks.findIndex((t) => t.id === task.id);
      if (taskIdx === -1) return prev;

      const [movedTask] = sourceCol.tasks.splice(taskIdx, 1);
      movedTask.column_id = targetColumnId;
      targetCol.tasks.push(movedTask);

      updated[sourceColIdx] = sourceCol;
      updated[targetColIdx] = targetCol;
      return updated;
    });
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTask(null);
    setActiveColumn(null);

    if (!over) return;

    const activeData = active.data.current;

    // Handle column reorder
    if (activeData?.type === "column") {
      const oldIdx = columns.findIndex((c) => c.id === active.id);
      const overData = over.data.current;
      let newIdx = oldIdx;

      if (overData?.type === "column") {
        newIdx = columns.findIndex((c) => c.id === over.id);
      }

      if (oldIdx !== newIdx) {
        const reordered = arrayMove(columns, oldIdx, newIdx);
        setColumns(reordered);
        try {
          await reorderColumns(
            boardId,
            reordered.map((c) => c.id)
          );
        } catch {
          fetchBoard();
        }
      }
      return;
    }

    // Handle task move
    if (activeData?.type === "task") {
      const task = activeData.task as TaskCard;
      // Find the task's current column after drag-over mutations
      const currentCol = columns.find((c) =>
        c.tasks.some((t) => t.id === task.id)
      );
      if (!currentCol) return;

      const taskIdx = currentCol.tasks.findIndex((t) => t.id === task.id);

      try {
        await moveTask(task.id, currentCol.id, taskIdx);
      } catch {
        fetchBoard();
      }
    }
  }

  // -------------------------------------------------------------------------
  // Task CRUD
  // -------------------------------------------------------------------------

  async function handleAddTask(columnId: string) {
    if (addingToColumn === columnId) {
      // Submit the task
      if (!newTaskTitle.trim()) return;
      setAddingTask(true);
      try {
        const task = await addTaskToBoard(boardId, columnId, {
          title: newTaskTitle.trim(),
        });
        if (!task || !task.id) {
          throw new Error("Task was not saved — server returned no id");
        }
        setColumns((prev) =>
          prev.map((col) =>
            col.id === columnId
              ? {
                  ...col,
                  tasks: [
                    ...col.tasks,
                    {
                      id: task.id,
                      title: task.title,
                      description: task.description,
                      status: task.status,
                      priority: task.priority,
                      due_date: task.due_date,
                      assigned_to: task.assigned_to,
                      labels: task.labels ?? [],
                      position: task.position,
                      column_id: task.column_id,
                      assigned_profile: null,
                    },
                  ],
                }
              : col
          )
        );
        setNewTaskTitle("");
        setAddingToColumn(null);
        toast.success("Task added");
        // Re-fetch from server to make sure what we show matches what's persisted
        await fetchBoard();
      } catch (err) {
        toast.error(
          err instanceof Error
            ? `Couldn't save task: ${err.message}`
            : "Couldn't save task"
        );
      } finally {
        setAddingTask(false);
      }
    } else {
      setAddingToColumn(columnId);
      setNewTaskTitle("");
    }
  }

  function handleTaskClick(taskId: string) {
    const task = columns.flatMap((c) => c.tasks).find((t) => t.id === taskId);
    if (task) {
      setSelectedTask(task);
      setModalOpen(true);
    }
  }

  async function handleTaskUpdate(
    taskId: string,
    data: Partial<{
      title: string;
      description: string;
      priority: string;
      status: string;
      due_date: string | null;
      assigned_to: string | null;
    }>
  ) {
    const supabase = createClient();
    const { error } = await supabase
      .from("tasks")
      .update(data)
      .eq("id", taskId);
    if (error) throw new Error(error.message);

    // Refresh data
    await fetchBoard();
  }

  async function handleTaskDelete(taskId: string) {
    const supabase = createClient();
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);
    if (error) throw new Error(error.message);

    setColumns((prev) =>
      prev.map((col) => ({
        ...col,
        tasks: col.tasks.filter((t) => t.id !== taskId),
      }))
    );
  }

  // -------------------------------------------------------------------------
  // Column CRUD
  // -------------------------------------------------------------------------

  async function handleAddColumn() {
    if (!newColumnName.trim()) return;
    setAddingColumn(true);
    try {
      const col = await createColumn(boardId, newColumnName.trim());
      setColumns((prev) => [
        ...prev,
        { ...col, tasks: [] },
      ]);
      setNewColumnName("");
      setShowAddColumn(false);
    } catch {
      // keep form open
    } finally {
      setAddingColumn(false);
    }
  }

  async function handleEditColumn(
    columnId: string,
    name: string,
    color: string
  ) {
    const newName = window.prompt("Column name:", name);
    if (newName && newName !== name) {
      try {
        await updateColumnAction(columnId, { name: newName });
        setColumns((prev) =>
          prev.map((c) =>
            c.id === columnId ? { ...c, name: newName } : c
          )
        );
      } catch {
        // silent
      }
    }
  }

  async function handleDeleteColumn(columnId: string) {
    if (!window.confirm("Delete this column? Tasks will be unlinked.")) return;
    try {
      await deleteColumnAction(columnId);
      setColumns((prev) => prev.filter((c) => c.id !== columnId));
    } catch {
      // silent
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!board) return null;

  return (
    <AnimatedPage>
      <div className="space-y-4">
        <PageHeader
          title={board.name}
          description={board.description ?? undefined}
          backHref="/boards"
          backLabel="Back to Boards"
        />

        <CollaborationToolbar
          entityType="board"
          entityId={boardId}
          entityTitle={board.name}
        />

        {/* Kanban board */}
        <div className="overflow-x-auto pb-4">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={columnIds}
              strategy={horizontalListSortingStrategy}
            >
              <div className="flex items-start gap-4">
                {columns.map((column) => (
                  <div key={column.id} className="flex flex-col gap-2">
                    <KanbanColumn
                      column={column}
                      onAddTask={handleAddTask}
                      onEditColumn={handleEditColumn}
                      onDeleteColumn={handleDeleteColumn}
                      onTaskClick={handleTaskClick}
                    />

                    {/* Inline add task form */}
                    {addingToColumn === column.id && (
                      <div className="w-72 rounded-lg border border-zinc-200 bg-white p-2 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
                        <input
                          type="text"
                          value={newTaskTitle}
                          onChange={(e) => setNewTaskTitle(e.target.value)}
                          placeholder="Task title..."
                          className="mb-2 w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleAddTask(column.id);
                            if (e.key === "Escape") setAddingToColumn(null);
                          }}
                          disabled={addingTask}
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleAddTask(column.id)}
                            disabled={addingTask || !newTaskTitle.trim()}
                          >
                            {addingTask ? (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            ) : null}
                            Add
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setAddingToColumn(null)}
                            disabled={addingTask}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Add column */}
                <div className="shrink-0">
                  {showAddColumn ? (
                    <div className="w-72 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
                      <input
                        type="text"
                        value={newColumnName}
                        onChange={(e) => setNewColumnName(e.target.value)}
                        placeholder="Column name..."
                        className="mb-2 w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAddColumn();
                          if (e.key === "Escape") setShowAddColumn(false);
                        }}
                        disabled={addingColumn}
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={handleAddColumn}
                          disabled={addingColumn || !newColumnName.trim()}
                        >
                          {addingColumn ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          ) : null}
                          Add Column
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setShowAddColumn(false)}
                          disabled={addingColumn}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      className="h-auto w-72 justify-start gap-1.5 border-dashed py-6 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                      onClick={() => setShowAddColumn(true)}
                    >
                      <Plus className="h-4 w-4" />
                      Add Column
                    </Button>
                  )}
                </div>
              </div>
            </SortableContext>

            <DragOverlay>
              {activeTask && <KanbanCardOverlay task={activeTask} />}
              {activeColumn && <KanbanColumnOverlay column={activeColumn} />}
            </DragOverlay>
          </DndContext>
        </div>
      </div>

      {/* Task detail modal */}
      <TaskDetailModal
        task={selectedTask}
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedTask(null);
        }}
        onUpdate={handleTaskUpdate}
        onDelete={handleTaskDelete}
        members={members}
      />
    </AnimatedPage>
  );
}
