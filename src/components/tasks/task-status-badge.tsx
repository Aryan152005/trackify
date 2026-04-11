import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/lib/types/database";

interface TaskStatusBadgeProps {
  status: TaskStatus;
}

export function TaskStatusBadge({ status }: TaskStatusBadgeProps) {
  const styles = {
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    "in-progress": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    done: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    cancelled: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
  };

  return (
    <span
      className={cn(
        "rounded-full px-2 py-1 text-xs font-medium",
        styles[status] || styles.pending
      )}
    >
      {status.replace("-", " ")}
    </span>
  );
}
