"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO, subDays } from "date-fns";
import { chartAnim, tooltipStyle, tooltipWrapper, tooltipCursor, activeDot } from "@/lib/charts/theme";
import { useIsMobile } from "@/lib/hooks/use-media-query";

interface DashboardChartsProps {
  entries: Array<{ date: string; productivity_score: number | null; status: string }>;
  weekEntries: Array<{ date: string; productivity_score: number | null }>;
}

export function DashboardCharts({ entries, weekEntries }: DashboardChartsProps) {
  const isMobile = useIsMobile();
  // Prepare productivity trend data (last 14 days)
  const last14Days = Array.from({ length: 14 }, (_, i) => {
    const date = subDays(new Date(), 13 - i);
    return format(date, "yyyy-MM-dd");
  });

  const productivityData = last14Days.map((date) => {
    const dayEntries = entries.filter((e) => e.date === date);
    const scores = dayEntries.map((e) => e.productivity_score).filter((s): s is number => s !== null);
    const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    return {
      date: format(parseISO(date), "MMM d"),
      score: avg,
      entries: dayEntries.length,
    };
  });

  // Status distribution (last 30 days)
  const statusCounts = entries.reduce(
    (acc, entry) => {
      acc[entry.status] = (acc[entry.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const statusData = [
    { name: "Done", value: statusCounts["done"] || 0, fill: "#10b981" },
    { name: "In Progress", value: statusCounts["in-progress"] || 0, fill: "#f59e0b" },
    { name: "Blocked", value: statusCounts["blocked"] || 0, fill: "#ef4444" },
  ];

  // Weekly productivity
  const weeklyData = weekEntries.map((entry) => ({
    day: format(parseISO(entry.date), "EEE"),
    score: entry.productivity_score || 0,
  }));

  return (
    <div className="space-y-6">
      {/* Productivity Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Productivity Trend</CardTitle>
          <CardDescription>Average productivity score over the last 14 days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[240px] sm:h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={productivityData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="dashScore" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
                <linearGradient id="dashEntries" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#ec4899" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-700" />
              <XAxis
                dataKey="date"
                className="text-xs"
                tick={{ fontSize: isMobile ? 10 : 12 }}
                tickMargin={8}
                interval={isMobile ? 2 : 0}
                angle={isMobile ? -35 : 0}
                textAnchor={isMobile ? "end" : "middle"}
                height={isMobile ? 50 : 30}
              />
              <YAxis domain={[0, 10]} className="text-xs" tick={{ fontSize: isMobile ? 10 : 12 }} width={isMobile ? 28 : 40} />
              <Tooltip contentStyle={tooltipStyle} wrapperStyle={tooltipWrapper} cursor={tooltipCursor} />
              {!isMobile && <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />}
              <Line
                type="monotone"
                dataKey="score"
                stroke="url(#dashScore)"
                strokeWidth={2.5}
                dot={false}
                activeDot={activeDot}
                name="Avg Score"
                {...chartAnim}
              />
              <Line
                type="monotone"
                dataKey="entries"
                stroke="url(#dashEntries)"
                strokeWidth={2.5}
                dot={false}
                activeDot={activeDot}
                name="Entries"
                {...chartAnim}
              />
            </LineChart>
          </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Status Distribution & Weekly Productivity */}
      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Status Distribution</CardTitle>
            <CardDescription>Last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[220px] sm:h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  {statusData.map((d, i) => (
                    <linearGradient key={i} id={`statBar-${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={d.fill} stopOpacity={1} />
                      <stop offset="100%" stopColor={d.fill} stopOpacity={0.55} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-700" vertical={false} />
                <XAxis dataKey="name" className="text-xs" tick={{ fontSize: isMobile ? 10 : 12 }} tickMargin={8} />
                <YAxis className="text-xs" tick={{ fontSize: isMobile ? 10 : 12 }} width={isMobile ? 28 : 40} />
                <Tooltip contentStyle={tooltipStyle} wrapperStyle={tooltipWrapper} cursor={tooltipCursor} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]} {...chartAnim}>
                  {statusData.map((_, i) => (
                    <Cell key={i} fill={`url(#statBar-${i})`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>This Week</CardTitle>
            <CardDescription>Daily productivity scores</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[220px] sm:h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="weekBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={1} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0.6} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-700" vertical={false} />
                <XAxis dataKey="day" className="text-xs" tick={{ fontSize: isMobile ? 10 : 12 }} tickMargin={8} />
                <YAxis domain={[0, 10]} className="text-xs" tick={{ fontSize: isMobile ? 10 : 12 }} width={isMobile ? 28 : 40} />
                <Tooltip contentStyle={tooltipStyle} wrapperStyle={tooltipWrapper} cursor={tooltipCursor} />
                <Bar dataKey="score" fill="url(#weekBar)" radius={[8, 8, 0, 0]} {...chartAnim} />
              </BarChart>
            </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
