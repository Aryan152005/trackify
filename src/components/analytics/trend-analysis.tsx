"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO, startOfWeek, eachWeekOfInterval, subWeeks } from "date-fns";

interface TrendAnalysisProps {
  entries: Array<{
    date: string;
    productivity_score: number | null;
    status: string;
  }>;
}

export function TrendAnalysis({ entries }: TrendAnalysisProps) {
  const today = new Date();
  const weeks = eachWeekOfInterval(
    {
      start: subWeeks(today, 11),
      end: today,
    },
    { weekStartsOn: 1 }
  );

  const weeklyData = weeks.map((weekStart) => {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const weekEntries = entries.filter((e) => {
      const entryDate = parseISO(e.date);
      return entryDate >= weekStart && entryDate <= weekEnd;
    });

    const scores = weekEntries
      .map((e) => e.productivity_score)
      .filter((s): s is number => s !== null);
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

    return {
      week: format(weekStart, "MMM d"),
      score: avgScore,
      entries: weekEntries.length,
      done: weekEntries.filter((e) => e.status === "done").length,
      completionRate:
        weekEntries.length > 0
          ? (weekEntries.filter((e) => e.status === "done").length / weekEntries.length) * 100
          : 0,
    };
  });

  return (
    <Card className="border-2 border-blue-200 dark:border-blue-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
          <span className="h-2 w-2 rounded-full bg-blue-500"></span>
          Weekly Trends
        </CardTitle>
        <CardDescription>12-week productivity and completion trends</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={weeklyData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-700" />
            <XAxis
              dataKey="week"
              className="text-xs"
              tick={{ fill: "currentColor" }}
              interval="preserveStartEnd"
            />
            <YAxis className="text-xs" tick={{ fill: "currentColor" }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--background)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#6366f1"
              strokeWidth={2}
              dot={{ fill: "#6366f1", r: 4 }}
              name="Avg Score"
            />
            <Line
              type="monotone"
              dataKey="completionRate"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ fill: "#10b981", r: 4 }}
              name="Completion %"
            />
            <Line
              type="monotone"
              dataKey="entries"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={{ fill: "#f59e0b", r: 4 }}
              name="Entries"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
