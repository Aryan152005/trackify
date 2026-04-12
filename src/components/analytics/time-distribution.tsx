"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { format, parseISO } from "date-fns";
import { chartAnim, tooltipStyle, tooltipWrapper } from "@/lib/charts/theme";
import { useIsMobile } from "@/lib/hooks/use-media-query";

interface TimeDistributionProps {
  timerSessions: Array<{ started_at: string; duration_seconds: number }>;
  entries: Array<{ date: string }>;
}

export function TimeDistribution({ timerSessions, entries }: TimeDistributionProps) {
  const isMobile = useIsMobile();
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
          <div className="h-[260px] sm:h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <defs>
                {colors.map((c, i) => (
                  <linearGradient key={i} id={`timeSlice-${i}`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={c} stopOpacity={0.7} />
                    <stop offset="100%" stopColor={c} stopOpacity={1} />
                  </linearGradient>
                ))}
              </defs>
              <Pie
                data={dayStats}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={isMobile ? false : ({ name, hours }) => `${name}: ${hours}h`}
                innerRadius={isMobile ? 40 : 45}
                outerRadius={isMobile ? 75 : 90}
                paddingAngle={2}
                dataKey="value"
                {...chartAnim}
              >
                {dayStats.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={`url(#timeSlice-${index})`} stroke="rgb(24 24 27)" strokeWidth={1} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={tooltipStyle}
                wrapperStyle={tooltipWrapper}
                formatter={(value: number) => [`${(value / 3600).toFixed(1)}h`, "Time"]}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-[300px] items-center justify-center text-zinc-500 dark:text-zinc-400">
            No timer data available. Start tracking your time!
          </div>
        )}
      </CardContent>
    </Card>
  );
}
