"use client";

import React, { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  rectIntersection,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { KanbanColumn, KanbanColumnOverlay } from "./kanban-column";
import { KanbanCardOverlay } from "./kanban-card";
import type { BoardColumnWithTasks, TaskCard } from "@/lib/types/board";

interface KanbanBoardProps {
  boardId: string;
  columns: BoardColumnWithTasks[];
  onMoveTask: (taskId: string, targetColumnId: string, newPosition: number) => Promise<void>;
  onReorderColumns: (columnIds: string[]) => Promise<void>;
  onAddTask?: (columnId: string) => void;
  onEditColumn?: (columnId: string, name: string, color: string) => void;
  onDeleteColumn?: (columnId: string) => void;
  onTaskClick?: (taskId: string) => void;
}

type ActiveItem =
  | { type: "column"; column: BoardColumnWithTasks }
  | { type: "task"; task: TaskCard }
  | null;

export function KanbanBoard({
  boardId,
  columns: initialColumns,
  onMoveTask,
  onReorderColumns,
  onAddTask,
  onEditColumn,
  onDeleteColumn,
  onTaskClick,
}: KanbanBoardProps) {
  const [columns, setColumns] = useState(initialColumns);
  const [activeItem, setActiveItem] = useState<ActiveItem>(null);

  // Keep local state in sync when props change
  React.useEffect(() => {
    setColumns(initialColumns);
  }, [initialColumns]);

  const columnIds = useMemo(() => columns.map((c) => c.id), [columns]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    })
  );

  /** Find which column a task lives in. */
  const findColumnByTaskId = useCallback(
    (taskId: string): BoardColumnWithTasks | undefined => {
      return columns.find((col) => col.tasks.some((t) => t.id === taskId));
    },
    [columns]
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event;
      const data = active.data.current;

      if (data?.type === "column") {
        setActiveItem({ type: "column", column: data.column });
      } else if (data?.type === "task") {
        setActiveItem({ type: "task", task: data.task });
      }
    },
    []
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) return;

      const activeData = active.data.current;
      const overData = over.data.current;

      // Only handle task-over-task or task-over-column for cross-column moves
      if (activeData?.type !== "task") return;

      const activeTaskId = active.id as string;
      const sourceColumn = findColumnByTaskId(activeTaskId);
      if (!sourceColumn) return;

      let targetColumnId: string | null = null;

      if (overData?.type === "task") {
        // Dragging over another task - find its column
        const overColumn = findColumnByTaskId(over.id as string);
        if (overColumn) targetColumnId = overColumn.id;
      } else if (overData?.type === "column") {
        // Dragging over a column droppable
        targetColumnId = overData.column.id;
      } else if (typeof over.id === "string" && over.id.startsWith("column-droppable-")) {
        targetColumnId = over.id.replace("column-droppable-", "");
      }

      if (!targetColumnId || targetColumnId === sourceColumn.id) return;

      // Move task to new column optimistically
      setColumns((prev) => {
        const sourceCopy = prev.find((c) => c.id === sourceColumn.id);
        const targetCopy = prev.find((c) => c.id === targetColumnId);
        if (!sourceCopy || !targetCopy) return prev;

        const task = sourceCopy.tasks.find((t) => t.id === activeTaskId);
        if (!task) return prev;

        // Determine insertion index
        let insertIdx = targetCopy.tasks.length;
        if (overData?.type === "task") {
          const overIdx = targetCopy.tasks.findIndex((t) => t.id === (over.id as string));
          if (overIdx >= 0) insertIdx = overIdx;
        }

        return prev.map((col) => {
          if (col.id === sourceColumn.id) {
            return {
              ...col,
              tasks: col.tasks.filter((t) => t.id !== activeTaskId),
            };
          }
          if (col.id === targetColumnId) {
            const updated = [...col.tasks];
            updated.splice(insertIdx, 0, { ...task, column_id: targetColumnId });
            return { ...col, tasks: updated };
          }
          return col;
        });
      });
    },
    [findColumnByTaskId]
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveItem(null);

      if (!over) return;

      const activeData = active.data.current;

      // --- Column reorder ---
      if (activeData?.type === "column") {
        if (active.id !== over.id) {
          const snapshot = columns;
          const oldIdx = columns.findIndex((c) => c.id === active.id);
          const newIdx = columns.findIndex((c) => c.id === over.id);
          if (oldIdx >= 0 && newIdx >= 0) {
            const reordered = arrayMove(columns, oldIdx, newIdx);
            // Optimistic local update
            setColumns(reordered);
            try {
              await onReorderColumns(reordered.map((c) => c.id));
            } catch (err) {
              // Revert on failure
              setColumns(snapshot);
              toast.error(err instanceof Error ? err.message : "Could not reorder columns");
            }
          }
        }
        return;
      }

      // --- Task move / reorder ---
      if (activeData?.type === "task") {
        const taskId = active.id as string;
        const column = findColumnByTaskId(taskId);
        if (!column) return;

        const taskIdx = column.tasks.findIndex((t) => t.id === taskId);

        const snapshot = columns;
        const overData = over.data.current;
        if (overData?.type === "task" && column.tasks.some((t) => t.id === over.id)) {
          const overIdx = column.tasks.findIndex((t) => t.id === over.id);
          if (taskIdx !== overIdx) {
            setColumns((prev) =>
              prev.map((col) => {
                if (col.id !== column.id) return col;
                return { ...col, tasks: arrayMove(col.tasks, taskIdx, overIdx) };
              })
            );
          }
        }

        try {
          await onMoveTask(taskId, column.id, taskIdx >= 0 ? taskIdx : 0);
        } catch (err) {
          setColumns(snapshot);
          toast.error(err instanceof Error ? err.message : "Could not move task");
        }
      }
    },
    [columns, findColumnByTaskId, onMoveTask, onReorderColumns]
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={rectIntersection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
        <div className="flex gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-16rem)]">
          {columns.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              onAddTask={onAddTask ?? (() => {})}
              onEditColumn={onEditColumn ?? (() => {})}
              onDeleteColumn={onDeleteColumn ?? (() => {})}
              onTaskClick={onTaskClick}
            />
          ))}
        </div>
      </SortableContext>

      <DragOverlay dropAnimation={null}>
        {activeItem?.type === "column" && (
          <KanbanColumnOverlay column={activeItem.column} />
        )}
        {activeItem?.type === "task" && (
          <KanbanCardOverlay task={activeItem.task} />
        )}
      </DragOverlay>
    </DndContext>
  );
}
