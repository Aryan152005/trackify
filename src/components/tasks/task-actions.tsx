"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Task } from "@/lib/types/database";
import { CheckCircle2, XCircle, Play } from "lucide-react";

interface TaskActionsProps {
  task: Task;
}

export function TaskActions({ task }: TaskActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function updateStatus(newStatus: Task["status"]) {
    setLoading(true);
    try {
      const updateData: Partial<Task> = {
        status: newStatus,
      };

      if (newStatus === "done" && task.status !== "done") {
        updateData.completed_at = new Date().toISOString();
      } else if (newStatus !== "done") {
        updateData.completed_at = null;
      }

      const { error } = await supabase.from("tasks").update(updateData).eq("id", task.id);

      if (error) {
        console.error("Error updating task:", error);
        return;
      }

      router.refresh();
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {task.status !== "done" && (
          <Button
            className="w-full"
            onClick={() => updateStatus("done")}
            disabled={loading}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Mark as Done
          </Button>
        )}

        {task.status === "pending" && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => updateStatus("in-progress")}
            disabled={loading}
          >
            <Play className="mr-2 h-4 w-4" />
            Start Task
          </Button>
        )}

        {task.status === "done" && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => updateStatus("pending")}
            disabled={loading}
          >
            <XCircle className="mr-2 h-4 w-4" />
            Reopen Task
          </Button>
        )}

        {task.status === "in-progress" && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => updateStatus("pending")}
            disabled={loading}
          >
            <XCircle className="mr-2 h-4 w-4" />
            Mark as Pending
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
