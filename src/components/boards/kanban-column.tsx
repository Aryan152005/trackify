"use client";

import React, { useState } from "react";
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { MoreHorizontal, Plus, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { KanbanCard } from "./kanban-card";
import type { BoardColumnWithTasks } from "@/lib/types/board";

interface KanbanColumnProps {
  column: BoardColumnWithTasks;
  onAddTask: (columnId: string) => void;
  onEditColumn: (columnId: string, name: string, color: string) => void;
  onDeleteColumn: (columnId: string) => void;
  onTaskClick?: (taskId: string) => void;
}

export function KanbanColumn({
  column,
  onAddTask,
  onEditColumn,
  onDeleteColumn,
  onTaskClick,
}: KanbanColumnProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: column.id,
    data: {
      type: "column",
      column,
    },
  });

  const { setNodeRef: setDroppableRef } = useDroppable({
    id: `column-droppable-${column.id}`,
    data: {
      type: "column",
      column,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const taskIds = column.tasks.map((t) => t.id);

  return (
    <div
      ref={setSortableRef}
      style={style}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50",
        isDragging && "opacity-50"
      )}
    >
      {/* Column header */}
      <div
        className="flex items-center gap-2 p-3 pb-2"
        {...attributes}
        {...listeners}
      >
        {/* Color indicator */}
        <div
          className="h-5 w-1 shrink-0 rounded-full"
          style={{ backgroundColor: column.color }}
        />

        <h3 className="flex-1 truncate text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          {column.name}
        </h3>

        {/* Task count badge */}
        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-zinc-200 px-1.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
          {column.tasks.length}
        </span>

        {/* Add task button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={(e) => {
            e.stopPropagation();
            onAddTask(column.id);
          }}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>

        {/* Menu */}
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>

          {menuOpen && (
            <>
              {/* Backdrop to close menu */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-full z-50 mt-1 w-36 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
                <button
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  onClick={() => {
                    setMenuOpen(false);
                    onEditColumn(column.id, column.name, column.color);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit column
                </button>
                <button
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                  onClick={() => {
                    setMenuOpen(false);
                    onDeleteColumn(column.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete column
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Task list (droppable) */}
      <div
        ref={setDroppableRef}
        className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2"
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {column.tasks.map((task) => (
            <KanbanCard
              key={task.id}
              task={task}
              onClick={onTaskClick ?? (() => {})}
            />
          ))}
        </SortableContext>

        {column.tasks.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-zinc-300 py-8 text-xs text-zinc-400 dark:border-zinc-600 dark:text-zinc-500">
            No tasks yet
          </div>
        )}
      </div>

      {/* Footer: add task */}
      <div className="p-2 pt-0">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-1.5 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          onClick={() => onAddTask(column.id)}
        >
          <Plus className="h-3.5 w-3.5" />
          Add task
        </Button>
      </div>
    </div>
  );
}

/** Non-interactive column overlay for DragOverlay. */
export function KanbanColumnOverlay({ column }: { column: BoardColumnWithTasks }) {
  return (
    <div className="w-72 rotate-1 rounded-xl border border-indigo-300 bg-zinc-50 shadow-xl dark:border-indigo-600 dark:bg-zinc-800/80">
      <div className="flex items-center gap-2 p-3 pb-2">
        <div
          className="h-5 w-1 shrink-0 rounded-full"
          style={{ backgroundColor: column.color }}
        />
        <h3 className="flex-1 truncate text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          {column.name}
        </h3>
        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-zinc-200 px-1.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
          {column.tasks.length}
        </span>
      </div>
      <div className="px-2 pb-3">
        <div className="h-16 rounded-lg bg-zinc-200/50 dark:bg-zinc-700/30" />
      </div>
    </div>
  );
}
