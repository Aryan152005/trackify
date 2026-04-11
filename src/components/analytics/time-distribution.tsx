"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { format, parseISO } from "date-fns";

interface TimeDistributionProps {
  timerSessions: Array<{ started_at: string; duration_seconds: number }>;
  entries: Array<{ date: string }>;
}

export function TimeDistribution({ timerSessions, entries }: TimeDistributionProps) {
  // Group by day of week
  const dayStats = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ].map((day, index) => {
    const sessions = timerSessions.filter((s) => {
      const date = parseISO(s.started_at);
      return date.getDay() === (index === 6 ? 0 : index + 1);
    });
    const totalSeconds = sessions.reduce((sum, s) => sum + s.duration_seconds, 0);
    return {
      name: day.slice(0, 3),
      fullName: day,
      hours: (totalSeconds / 3600).toFixed(1),
      value: totalSeconds,
    };
  });

  const colors = [
    "#6366f1",
    "#8b5cf6",
    "#ec4899",
    "#f59e0b",
    "#10b981",
    "#3b82f6",
    "#ef4444",
  ];

  return (
    <Card className="border-2 border-pink-200 dark:border-pink-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-pink-700 dark:text-pink-300">
          <span className="h-2 w-2 rounded-full bg-pink-500"></span>
          Time Distribution by Day
        </CardTitle>
        <CardDescription>When you work most (based on timer sessions)</CardDescription>
      </CardHeader>
      <CardContent>
        {timerSessions.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={dayStats}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, hours }) => `${name}: ${hours}h`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {dayStats.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--background)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                }}
                formatter={(value: number) => [`${(value / 3600).toFixed(1)}h`, "Time"]}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-[300px] items-center justify-center text-zinc-500 dark:text-zinc-400">
            No timer data available. Start tracking your time!
          </div>
        )}
      </CardContent>
    </Card>
  );
}
