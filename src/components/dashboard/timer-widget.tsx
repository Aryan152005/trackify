"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useWorkspaceId } from "@/lib/workspace/hooks";
import { Play, Pause, Square } from "lucide-react";

export function TimerWidget() {
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const workspaceId = useWorkspaceId();

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRunning) {
      interval = setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning]);

  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  async function handleStart() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("timer_sessions")
      .insert({
        user_id: user.id,
        workspace_id: workspaceId,
        started_at: new Date().toISOString(),
        duration_seconds: 0,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error starting timer:", error);
      return;
    }

    setSessionId(data.id);
    setStartTime(new Date());
    setIsRunning(true);
  }

  async function handlePause() {
    setIsRunning(false);
  }

  async function handleStop() {
    if (!sessionId || !startTime) return;

    const supabase = createClient();
    const duration = Math.floor((new Date().getTime() - startTime.getTime()) / 1000);

    await supabase
      .from("timer_sessions")
      .update({
        duration_seconds: duration,
        ended_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    setSeconds(0);
    setIsRunning(false);
    setStartTime(null);
    setSessionId(null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Focus Timer</CardTitle>
        <CardDescription>Track your work sessions</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center">
          <div className="mb-6 text-4xl font-bold text-indigo-600 dark:text-indigo-400">
            {formatTime(seconds)}
          </div>
          <div className="flex justify-center gap-2">
            {!isRunning ? (
              <Button onClick={handleStart} size="sm">
                <Play className="mr-2 h-4 w-4" />
                Start
              </Button>
            ) : (
              <>
                <Button onClick={handlePause} variant="outline" size="sm">
                  <Pause className="mr-2 h-4 w-4" />
                  Pause
                </Button>
                <Button onClick={handleStop} variant="destructive" size="sm">
                  <Square className="mr-2 h-4 w-4" />
                  Stop
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
