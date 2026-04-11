import { cn } from "@/lib/utils";
import type { TaskPriority } from "@/lib/types/database";

interface TaskPriorityBadgeProps {
  priority: TaskPriority;
}

export function TaskPriorityBadge({ priority }: TaskPriorityBadgeProps) {
  const styles = {
    low: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
    medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    high: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };

  return (
    <span
      className={cn(
        "rounded-full px-2 py-1 text-xs font-medium",
        styles[priority] || styles.medium
      )}
    >
      {priority}
    </span>
  );
}
