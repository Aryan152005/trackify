"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight,
  ChevronDown,
  Plus,
  GripVertical,
  Check,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TaskStatusBadge } from "@/components/tasks/task-status-badge";
import { TaskPriorityBadge } from "@/components/tasks/task-priority-badge";
import {
  getSubtasks,
  createSubtask,
} from "@/lib/tasks/advanced-actions";
import { createClient } from "@/lib/supabase/client";
import type { Task, TaskStatus } from "@/lib/types/database";

interface SubtaskListProps {
  parentTaskId: string;
  workspaceId: string;
}

export function SubtaskList({ parentTaskId, workspaceId }: SubtaskListProps) {
  const [subtasks, setSubtasks] = useState<Task[]>([]);
  const [expanded, setExpanded] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);

  const loadSubtasks = useCallback(async () => {
    try {
      const data = await getSubtasks(parentTaskId);
      setSubtasks(data as Task[]);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [parentTaskId]);

  useEffect(() => {
    loadSubtasks();
  }, [loadSubtasks]);

  const completedCount = subtasks.filter((s) => s.status === "done").length;
  const progress =
    subtasks.length > 0 ? (completedCount / subtasks.length) * 100 : 0;

  function handleAddSubtask() {
    if (!newTitle.trim()) return;

    startTransition(async () => {
      try {
        await createSubtask(parentTaskId, { title: newTitle.trim() });
        setNewTitle("");
        setShowAddForm(false);
        await loadSubtasks();
      } catch {
        // silently fail
      }
    });
  }

  async function handleToggleComplete(subtask: Task) {
    const supabase = createClient();
    const newStatus: TaskStatus =
      subtask.status === "done" ? "pending" : "done";

    const updateData: Record<string, unknown> = { status: newStatus };
    if (newStatus === "done") {
      updateData.completed_at = new Date().toISOString();
    } else {
      updateData.completed_at = null;
    }

    await supabase.from("tasks").update(updateData).eq("id", subtask.id);
    await loadSubtasks();
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading subtasks...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          Subtasks
          {subtasks.length > 0 && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              ({completedCount}/{subtasks.length})
            </span>
          )}
        </button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          <Plus className="mr-1 h-3 w-3" />
          Add
        </Button>
      </div>

      {/* Progress bar */}
      {subtasks.length > 0 && (
        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
          <motion.div
            className="h-full rounded-full bg-indigo-600 dark:bg-indigo-500"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
        </div>
      )}

      {/* Subtask list */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-1">
              {subtasks.map((subtask, index) => (
                <SubtaskItem
                  key={subtask.id}
                  subtask={subtask}
                  index={index}
                  onToggleComplete={handleToggleComplete}
                  workspaceId={workspaceId}
                  onSubtaskChange={loadSubtasks}
                />
              ))}

              {subtasks.length === 0 && !showAddForm && (
                <p className="py-3 text-center text-sm text-zinc-400 dark:text-zinc-500">
                  No subtasks yet
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add subtask form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-800">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddSubtask();
                  if (e.key === "Escape") {
                    setShowAddForm(false);
                    setNewTitle("");
                  }
                }}
                placeholder="Subtask title..."
                autoFocus
                className="flex-1 bg-transparent text-sm text-zinc-900 placeholder-zinc-400 outline-none dark:text-zinc-100 dark:placeholder-zinc-500"
              />
              <Button
                size="sm"
                onClick={handleAddSubtask}
                disabled={isPending || !newTitle.trim()}
              >
                {isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  "Add"
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowAddForm(false);
                  setNewTitle("");
                }}
              >
                Cancel
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SubtaskItem — recursive with expand for nested subtasks
// ---------------------------------------------------------------------------

function SubtaskItem({
  subtask,
  index,
  onToggleComplete,
  workspaceId,
  onSubtaskChange,
  depth = 0,
}: {
  subtask: Task;
  index: number;
  onToggleComplete: (task: Task) => void;
  workspaceId: string;
  onSubtaskChange: () => void;
  depth?: number;
}) {
  const [childExpanded, setChildExpanded] = useState(false);
  const [children, setChildren] = useState<Task[]>([]);
  const [hasChildren, setHasChildren] = useState(false);
  const isDone = subtask.status === "done";

  useEffect(() => {
    // Check if this subtask has its own children
    (async () => {
      try {
        const data = await getSubtasks(subtask.id);
        setChildren(data as Task[]);
        setHasChildren(data.length > 0);
      } catch {
        // ignore
      }
    })();
  }, [subtask.id]);

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.03 }}
        className={cn(
          "group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800",
          isDone && "opacity-60"
        )}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        <GripVertical className="h-3 w-3 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />

        {hasChildren ? (
          <button
            onClick={() => setChildExpanded(!childExpanded)}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            {childExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
        ) : (
          <span className="w-3" />
        )}

        <button
          onClick={() => onToggleComplete(subtask)}
          className={cn(
            "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
            isDone
              ? "border-green-500 bg-green-500 text-white"
              : "border-zinc-300 hover:border-indigo-400 dark:border-zinc-600"
          )}
        >
          {isDone && <Check className="h-3 w-3" />}
        </button>

        <span
          className={cn(
            "flex-1 text-sm text-zinc-800 dark:text-zinc-200",
            isDone && "line-through text-zinc-500 dark:text-zinc-400"
          )}
        >
          {subtask.title}
        </span>

        <TaskPriorityBadge priority={subtask.priority} />
        <TaskStatusBadge status={subtask.status} />
      </motion.div>

      {/* Nested children */}
      <AnimatePresence>
        {childExpanded && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            {children.map((child, i) => (
              <SubtaskItem
                key={child.id}
                subtask={child}
                index={i}
                onToggleComplete={onToggleComplete}
                workspaceId={workspaceId}
                onSubtaskChange={onSubtaskChange}
                depth={depth + 1}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
