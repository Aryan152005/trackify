"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Link2,
  X,
  Search,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  ShieldAlert,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TaskStatusBadge } from "@/components/tasks/task-status-badge";
import {
  addDependency,
  removeDependency,
  getTaskDependencies,
  searchTasks,
} from "@/lib/tasks/advanced-actions";
import type { TaskDependencyWithDetails, DependencyType } from "@/lib/types/advanced-tasks";
import type { TaskStatus, TaskPriority } from "@/lib/types/database";

interface TaskDependenciesProps {
  taskId: string;
  workspaceId: string;
}

interface SearchResult {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
}

export function TaskDependencies({
  taskId,
  workspaceId,
}: TaskDependenciesProps) {
  const [blocking, setBlocking] = useState<TaskDependencyWithDetails[]>([]);
  const [blockedBy, setBlockedBy] = useState<TaskDependencyWithDetails[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [depType, setDepType] = useState<DependencyType>("blocks");
  const [depDirection, setDepDirection] = useState<"blocking" | "blocked_by">(
    "blocked_by"
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDeps = useCallback(async () => {
    try {
      const data = await getTaskDependencies(taskId);
      setBlocking(data.blocking);
      setBlockedBy(data.blockedBy);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    loadDeps();
  }, [loadDeps]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        const results = await searchTasks(workspaceId, searchQuery);
        // Exclude self and already-linked tasks
        const existing = new Set([
          taskId,
          ...blocking.map((d) => d.task_id),
          ...blockedBy.map((d) => d.depends_on),
        ]);
        setSearchResults(
          results.filter((r: SearchResult) => !existing.has(r.id))
        );
      } catch {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery, workspaceId, taskId, blocking, blockedBy]);

  function handleAdd(targetId: string) {
    setError(null);
    startTransition(async () => {
      try {
        if (depDirection === "blocked_by") {
          // This task depends on target
          await addDependency(workspaceId, taskId, targetId, depType);
        } else {
          // Target depends on this task
          await addDependency(workspaceId, targetId, taskId, depType);
        }
        setShowSearch(false);
        setSearchQuery("");
        await loadDeps();
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Failed to add dependency"
        );
      }
    });
  }

  function handleRemove(depId: string) {
    startTransition(async () => {
      try {
        await removeDependency(depId);
        await loadDeps();
      } catch {
        // ignore
      }
    });
  }

  const isBlocked = blockedBy.some(
    (d) =>
      d.dependency_type === "blocks" &&
      d.depends_on_task &&
      (d.depends_on_task as unknown as SearchResult).status !== "done"
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading dependencies...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-zinc-500" />
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Dependencies
          </span>
          {isBlocked ? (
            <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
              <ShieldAlert className="h-3 w-3" />
              Blocked
            </span>
          ) : (
            blocking.length + blockedBy.length > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                <CheckCircle2 className="h-3 w-3" />
                Clear
              </span>
            )
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowSearch(!showSearch)}
        >
          <Link2 className="mr-1 h-3 w-3" />
          Add
        </Button>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400"
          >
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto">
              <X className="h-3 w-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Blocked by section */}
      {blockedBy.length > 0 && (
        <div className="space-y-1">
          <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            <ArrowLeft className="h-3 w-3" />
            Blocked by
          </p>
          {blockedBy.map((dep) => {
            const depTask = dep.depends_on_task as unknown as SearchResult | undefined;
            const isResolved = depTask?.status === "done";
            return (
              <motion.div
                key={dep.id}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "flex items-center justify-between rounded-lg border px-3 py-2 text-sm",
                  dep.dependency_type === "blocks" && !isResolved
                    ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/10"
                    : "border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800"
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-zinc-800 dark:text-zinc-200",
                      isResolved && "line-through text-zinc-500"
                    )}
                  >
                    {depTask?.title ?? "Unknown task"}
                  </span>
                  {depTask && (
                    <TaskStatusBadge status={depTask.status} />
                  )}
                  <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
                    {dep.dependency_type}
                  </span>
                </div>
                <button
                  onClick={() => handleRemove(dep.id)}
                  className="text-zinc-400 hover:text-red-500 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Blocking section */}
      {blocking.length > 0 && (
        <div className="space-y-1">
          <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            <ArrowRight className="h-3 w-3" />
            Blocking
          </p>
          {blocking.map((dep) => {
            const depTask = dep.task as unknown as SearchResult | undefined;
            return (
              <motion.div
                key={dep.id}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              >
                <div className="flex items-center gap-2">
                  <span className="text-zinc-800 dark:text-zinc-200">
                    {depTask?.title ?? "Unknown task"}
                  </span>
                  {depTask && (
                    <TaskStatusBadge status={depTask.status} />
                  )}
                  <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
                    {dep.dependency_type}
                  </span>
                </div>
                <button
                  onClick={() => handleRemove(dep.id)}
                  className="text-zinc-400 hover:text-red-500 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </motion.div>
            );
          })}
        </div>
      )}

      {blocking.length === 0 && blockedBy.length === 0 && !showSearch && (
        <p className="py-2 text-center text-sm text-zinc-400 dark:text-zinc-500">
          No dependencies
        </p>
      )}

      {/* Add dependency search */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800">
              {/* Options row */}
              <div className="flex items-center gap-2 text-xs">
                <select
                  value={depDirection}
                  onChange={(e) =>
                    setDepDirection(
                      e.target.value as "blocking" | "blocked_by"
                    )
                  }
                  className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200"
                >
                  <option value="blocked_by">This task is blocked by</option>
                  <option value="blocking">This task blocks</option>
                </select>
                <select
                  value={depType}
                  onChange={(e) =>
                    setDepType(e.target.value as DependencyType)
                  }
                  className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200"
                >
                  <option value="blocks">Blocks</option>
                  <option value="related">Related</option>
                </select>
              </div>

              {/* Search input */}
              <div className="flex items-center gap-2 rounded border border-zinc-300 bg-white px-2 dark:border-zinc-600 dark:bg-zinc-700">
                <Search className="h-3 w-3 text-zinc-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tasks..."
                  autoFocus
                  className="flex-1 bg-transparent py-1.5 text-sm text-zinc-900 placeholder-zinc-400 outline-none dark:text-zinc-100 dark:placeholder-zinc-500"
                />
              </div>

              {/* Results */}
              {searchResults.length > 0 && (
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {searchResults.map((result) => (
                    <button
                      key={result.id}
                      onClick={() => handleAdd(result.id)}
                      disabled={isPending}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-600"
                    >
                      <span className="flex-1 text-zinc-800 dark:text-zinc-200">
                        {result.title}
                      </span>
                      <TaskStatusBadge status={result.status} />
                    </button>
                  ))}
                </div>
              )}

              {searchQuery && searchResults.length === 0 && (
                <p className="py-1 text-center text-xs text-zinc-400">
                  No matching tasks found
                </p>
              )}

              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowSearch(false);
                    setSearchQuery("");
                    setError(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
