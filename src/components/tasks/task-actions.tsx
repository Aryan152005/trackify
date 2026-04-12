"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Task } from "@/lib/types/database";
import { CheckCircle2, XCircle, Play, Loader2 } from "lucide-react";

interface TaskActionsProps {
  task: Task;
}

export function TaskActions({ task }: TaskActionsProps) {
  const router = useRouter();
  // Optimistic status — shown immediately on click, reverted on error
  const [optimisticStatus, setOptimisticStatus] = useState<Task["status"]>(task.status);
  const [pendingStatus, setPendingStatus] = useState<Task["status"] | null>(null);
  const [, startTransition] = useTransition();
  const supabase = createClient();

  const current = pendingStatus ?? optimisticStatus;

  function updateStatus(newStatus: Task["status"]) {
    if (pendingStatus) return; // prevent double-click
    const prev = optimisticStatus;
    setOptimisticStatus(newStatus);
    setPendingStatus(newStatus);

    startTransition(async () => {
      try {
        const updateData: Partial<Task> = { status: newStatus };
        if (newStatus === "done" && prev !== "done") {
          updateData.completed_at = new Date().toISOString();
        } else if (newStatus !== "done") {
          updateData.completed_at = null;
        }
        const { error } = await supabase.from("tasks").update(updateData).eq("id", task.id);
        if (error) throw error;
        toast.success(
          newStatus === "done" ? "Marked as done"
          : newStatus === "in-progress" ? "Task started"
          : "Task reopened"
        );
        router.refresh();
      } catch (err) {
        // Revert optimistic update
        setOptimisticStatus(prev);
        toast.error(err instanceof Error ? err.message : "Failed to update task");
      } finally {
        setPendingStatus(null);
      }
    });
  }

  const busy = !!pendingStatus;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {current !== "done" && (
          <Button className="w-full" onClick={() => updateStatus("done")} disabled={busy}>
            {busy && pendingStatus === "done" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            Mark as Done
          </Button>
        )}
        {current === "pending" && (
          <Button variant="outline" className="w-full" onClick={() => updateStatus("in-progress")} disabled={busy}>
            {busy && pendingStatus === "in-progress" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            Start Task
          </Button>
        )}
        {current === "done" && (
          <Button variant="outline" className="w-full" onClick={() => updateStatus("pending")} disabled={busy}>
            {busy && pendingStatus === "pending" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
            Reopen Task
          </Button>
        )}
        {current === "in-progress" && (
          <Button variant="outline" className="w-full" onClick={() => updateStatus("pending")} disabled={busy}>
            {busy && pendingStatus === "pending" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
            Mark as Pending
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
