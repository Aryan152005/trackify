import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Props {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  /**
   * Short sentence that TEACHES the user what this feature is for.
   * Shows under the description, before the action. Keep to one sentence.
   * E.g. "Tasks keep you on track so nothing falls through the cracks."
   */
  hint?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  /** Optional secondary action (e.g. "See a sample task" → /tasks/demo). */
  secondaryLabel?: string;
  secondaryHref?: string;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Shared empty-state for list pages. The canonical variant has three
 * layers the user's eye walks:
 *   1. Icon + Title — "you are on the X page, there's nothing here yet"
 *   2. Description — one-line literal (no items yet)
 *   3. Hint — one-line motivation (why you'd want items here)
 *   4. CTA(s) — how to create the first one
 *
 * Before the hint prop existed, empty pages reported absence ("No tasks
 * yet") without teaching value — new users saw blank canvases and
 * bounced. Always pass a `hint`.
 */
export function EmptyState({
  icon,
  title,
  description,
  hint,
  actionLabel,
  actionHref,
  onAction,
  secondaryLabel,
  secondaryHref,
  className,
  children,
}: Props) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-14 text-center dark:border-zinc-700 dark:bg-zinc-900/50",
        className
      )}
    >
      {icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
          {icon}
        </div>
      )}
      <div className="max-w-md space-y-1.5">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{title}</h3>
        {description && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
        )}
        {hint && (
          <p className="text-xs italic text-zinc-400 dark:text-zinc-500">
            {hint}
          </p>
        )}
      </div>
      {(actionLabel && (actionHref || onAction)) || secondaryLabel ? (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {actionLabel && (actionHref || onAction) && (
            actionHref ? (
              <Link href={actionHref}>
                <Button size="sm">{actionLabel}</Button>
              </Link>
            ) : (
              <Button size="sm" onClick={onAction}>{actionLabel}</Button>
            )
          )}
          {secondaryLabel && secondaryHref && (
            <Link href={secondaryHref}>
              <Button size="sm" variant="outline">{secondaryLabel}</Button>
            </Link>
          )}
        </div>
      ) : null}
      {children}
    </div>
  );
}
