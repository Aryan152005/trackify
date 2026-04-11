"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO, subDays, eachDayOfInterval } from "date-fns";

interface AnalyticsChartsProps {
  entries: Array<{
    date: string;
    productivity_score: number | null;
    status: string;
  }>;
}

export function AnalyticsCharts({ entries }: AnalyticsChartsProps) {
  // Last 30 days data
  const last30Days = eachDayOfInterval({
    start: subDays(new Date(), 29),
    end: new Date(),
  });

  const dailyData = last30Days.map((date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const dayEntries = entries.filter((e) => e.date === dateStr);
    const scores = dayEntries.map((e) => e.productivity_score).filter((s): s is number => s !== null);
    const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

    return {
      date: format(date, "MMM d"),
      fullDate: dateStr,
      score: avg,
      entries: dayEntries.length,
      done: dayEntries.filter((e) => e.status === "done").length,
      inProgress: dayEntries.filter((e) => e.status === "in-progress").length,
    };
  });

  return (
    <Card className="border-2 border-indigo-200 dark:border-indigo-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
          <span className="h-2 w-2 rounded-full bg-indigo-500"></span>
          Productivity Trends
        </CardTitle>
        <CardDescription>Daily productivity scores and entry counts</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={dailyData}>
            <defs>
              <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-700" />
            <XAxis
              dataKey="date"
              className="text-xs"
              tick={{ fill: "currentColor" }}
              interval="preserveStartEnd"
            />
            <YAxis domain={[0, 10]} className="text-xs" tick={{ fill: "currentColor" }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--background)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
              }}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="score"
              stroke="#6366f1"
              fillOpacity={1}
              fill="url(#colorScore)"
              name="Avg Score"
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="entries"
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={{ fill: "#8b5cf6", r: 3 }}
              name="Entries"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
