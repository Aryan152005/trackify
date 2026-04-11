"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Flag,
  UserPlus,
  Trash2,
  X,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  bulkUpdateTasks,
  bulkDeleteTasks,
} from "@/lib/tasks/advanced-actions";
import type { TaskStatus, TaskPriority } from "@/lib/types/database";

interface BulkActionsBarProps {
  selectedTaskIds: string[];
  workspaceId: string;
  onComplete: () => void;
}

export function BulkActionsBar({
  selectedTaskIds,
  workspaceId,
  onComplete,
}: BulkActionsBarProps) {
  const [isPending, startTransition] = useTransition();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeMenu, setActiveMenu] = useState<
    "status" | "priority" | "assign" | null
  >(null);

  const count = selectedTaskIds.length;

  function handleStatusChange(status: TaskStatus) {
    startTransition(async () => {
      await bulkUpdateTasks(selectedTaskIds, { status });
      setActiveMenu(null);
      onComplete();
    });
  }

  function handlePriorityChange(priority: TaskPriority) {
    startTransition(async () => {
      await bulkUpdateTasks(selectedTaskIds, { priority });
      setActiveMenu(null);
      onComplete();
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await bulkDeleteTasks(selectedTaskIds);
      setShowDeleteConfirm(false);
      onComplete();
    });
  }

  if (count === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
      >
        <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
          {/* Count badge */}
          <span className="flex items-center justify-center rounded-full bg-indigo-600 px-2.5 py-0.5 text-xs font-bold text-white">
            {count}
          </span>
          <span className="mr-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            selected
          </span>

          <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-700" />

          {/* Status */}
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setActiveMenu(activeMenu === "status" ? null : "status")
              }
              disabled={isPending}
            >
              <CheckCircle2 className="mr-1 h-4 w-4" />
              Status
            </Button>
            <AnimatePresence>
              {activeMenu === "status" && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  className="absolute bottom-full left-0 mb-2 w-40 rounded-lg border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
                >
                  {(
                    [
                      ["pending", "Pending"],
                      ["in-progress", "In Progress"],
                      ["done", "Done"],
                      ["cancelled", "Cancelled"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => handleStatusChange(value)}
                      className="flex w-full rounded px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    >
                      {label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Priority */}
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setActiveMenu(activeMenu === "priority" ? null : "priority")
              }
              disabled={isPending}
            >
              <Flag className="mr-1 h-4 w-4" />
              Priority
            </Button>
            <AnimatePresence>
              {activeMenu === "priority" && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  className="absolute bottom-full left-0 mb-2 w-32 rounded-lg border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
                >
                  {(
                    [
                      ["low", "Low"],
                      ["medium", "Medium"],
                      ["high", "High"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => handlePriorityChange(value)}
                      className="flex w-full rounded px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    >
                      {label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-700" />

          {/* Delete */}
          <div className="relative">
            {!showDeleteConfirm ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isPending}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                <Trash2 className="mr-1 h-4 w-4" />
                Delete
              </Button>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute bottom-full right-0 mb-2 w-64 rounded-lg border border-red-200 bg-white p-3 shadow-lg dark:border-red-800 dark:bg-zinc-800"
              >
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-red-700 dark:text-red-400">
                  <AlertTriangle className="h-4 w-4" />
                  Delete {count} task{count > 1 ? "s" : ""}?
                </div>
                <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
                  This action cannot be undone. All subtasks and dependencies
                  will also be removed.
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDelete}
                    disabled={isPending}
                  >
                    {isPending ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="mr-1 h-3 w-3" />
                    )}
                    Delete
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </motion.div>
            )}
          </div>

          <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-700" />

          {/* Close */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onComplete}
            className="text-zinc-500"
          >
            <X className="h-4 w-4" />
          </Button>

          {isPending && (
            <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
