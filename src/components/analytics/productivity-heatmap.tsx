"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { format, parseISO, startOfYear, eachDayOfInterval, isSameDay } from "date-fns";

interface ProductivityHeatmapProps {
  entries: Array<{
    date: string;
    productivity_score: number | null;
  }>;
}

export function ProductivityHeatmap({ entries }: ProductivityHeatmapProps) {
  const today = new Date();
  const yearStart = startOfYear(today);
  const days = eachDayOfInterval({ start: yearStart, end: today });

  // Group by week
  const weeks: Array<Array<{ date: Date; score: number | null }>> = [];
  let currentWeek: Array<{ date: Date; score: number | null }> = [];

  days.forEach((day) => {
    const entry = entries.find((e) => isSameDay(parseISO(e.date), day));
    currentWeek.push({
      date: day,
      score: entry?.productivity_score || null,
    });

    if (day.getDay() === 0 || isSameDay(day, today)) {
      weeks.push([...currentWeek]);
      currentWeek = [];
    }
  });

  const getColor = (score: number | null) => {
    if (score === null) return "bg-zinc-100 dark:bg-zinc-800";
    if (score >= 8) return "bg-green-500";
    if (score >= 6) return "bg-yellow-500";
    if (score >= 4) return "bg-orange-500";
    return "bg-red-500";
  };

  return (
    <Card className="border-2 border-green-200 dark:border-green-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-300">
          <span className="h-2 w-2 rounded-full bg-green-500"></span>
          Productivity Heatmap
        </CardTitle>
        <CardDescription>Daily productivity scores throughout the year</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="flex flex-col gap-1">
                {week.map((day, dayIndex) => (
                  <div
                    key={dayIndex}
                    className={`h-3 w-3 rounded ${getColor(day.score)} hover:ring-2 hover:ring-zinc-400 dark:hover:ring-zinc-600 transition`}
                    title={`${format(day.date, "MMM d")}: ${day.score || "No entry"}`}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
            <span>Less</span>
            <div className="flex gap-1">
              <div className="h-3 w-3 rounded bg-zinc-200 dark:bg-zinc-700"></div>
              <div className="h-3 w-3 rounded bg-red-500"></div>
              <div className="h-3 w-3 rounded bg-orange-500"></div>
              <div className="h-3 w-3 rounded bg-yellow-500"></div>
              <div className="h-3 w-3 rounded bg-green-500"></div>
            </div>
            <span>More</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
