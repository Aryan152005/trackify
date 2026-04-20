"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, Check, Pencil, Target } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlanTodayDrawer } from "@/components/today/plan-today-drawer";
import { toast } from "sonner";
import { updateTaskStatus } from "@/lib/tasks/actions";

export interface PlanTodayTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  due_time: string | null;
}

interface Props {
  /** Plan + hydrated task details for today. If null, user hasn't planned yet. */
  plan: {
    id: string;
    plan_date: string;
    task_ids: string[];
    intention: string | null;
    updated_at: string;
  } | null;
  tasks: PlanTodayTask[];
  /** True the very first time the user hits /today on this IST day AND hasn't planned yet. */
  autoOpen?: boolean;
}

/**
 * Plan-today section for /today. Renders one of three states:
 *   1. No plan + auto-open → drawer opens immediately (first visit of day)
 *   2. No plan + not auto-open → compact "Plan today" nudge card
 *   3. Plan exists → checklist of picked tasks with quick-toggle + "Replan" button
 */
export function PlanTodaySection({ plan, tasks, autoOpen = false }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(autoOpen);
  const [pending, startTransition] = useTransition();

  const pickedCount = plan?.task_ids.length ?? 0;
  const done = tasks.filter((t) => t.status === "done").length;

  function handleComplete(taskId: string) {
    startTransition(async () => {
      try {
        await updateTaskStatus(taskId, "done");
        toast.success("Nice.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't update task");
      }
    });
  }

  // State 2: no plan, ambient nudge
  if (!plan || pickedCount === 0) {
    return (
      <>
        <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50/60 to-white dark:border-indigo-900/50 dark:from-indigo-950/20 dark:to-zinc-900">
          <CardContent className="flex flex-col items-start gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:bg-indigo-400/10 dark:text-indigo-300">
                <Target className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  What are you actually doing today?
                </h3>
                <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                  Pick 3–5 things. Everything else can wait. A plan beats a to-do list.
                </p>
              </div>
            </div>
            <Button onClick={() => setOpen(true)} className="shrink-0 gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Plan today
            </Button>
          </CardContent>
        </Card>
        <PlanTodayDrawer
          open={open}
          onOpenChange={setOpen}
          onSaved={() => router.refresh()}
        />
      </>
    );
  }

  // State 3: plan exists
  return (
    <>
      <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50/40 to-white dark:border-emerald-900/40 dark:from-emerald-950/20 dark:to-zinc-900">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Today's plan
                <span className="ml-auto text-xs font-normal text-zinc-400 sm:ml-0">
                  {done}/{pickedCount} done
                </span>
              </CardTitle>
              {plan.intention && (
                <CardDescription className="mt-1 italic text-zinc-600 dark:text-zinc-300">
                  &ldquo;{plan.intention}&rdquo;
                </CardDescription>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpen(true)}
              className="shrink-0 gap-1.5"
            >
              <Pencil className="h-3 w-3" />
              Replan
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {tasks.map((t) => {
            const isDone = t.status === "done";
            return (
              <div
                key={t.id}
                className="flex items-center gap-2.5 rounded-md px-2 py-1.5 transition hover:bg-white/60 dark:hover:bg-zinc-800/40"
              >
                <button
                  type="button"
                  onClick={() => !isDone && handleComplete(t.id)}
                  disabled={pending || isDone}
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
                    isDone
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-zinc-300 hover:border-emerald-500 dark:border-zinc-600 dark:hover:border-emerald-400"
                  }`}
                  aria-label={isDone ? "Completed" : "Mark done"}
                >
                  {isDone && <Check className="h-3 w-3" />}
                </button>
                <Link
                  href={`/tasks/${t.id}`}
                  className={`min-w-0 flex-1 truncate text-sm ${
                    isDone
                      ? "text-zinc-400 line-through dark:text-zinc-500"
                      : "text-zinc-900 hover:text-indigo-600 dark:text-zinc-100 dark:hover:text-indigo-400"
                  }`}
                >
                  {t.title}
                </Link>
                {(t.priority === "urgent" || t.priority === "high") && !isDone && (
                  <span className="shrink-0 rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-red-700 dark:bg-red-900/30 dark:text-red-300">
                    {t.priority}
                  </span>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
      <PlanTodayDrawer
        open={open}
        onOpenChange={setOpen}
        initialTaskIds={plan.task_ids}
        initialIntention={plan.intention}
        onSaved={() => router.refresh()}
      />
    </>
  );
}
