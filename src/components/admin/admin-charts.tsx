"use client";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { chartAnim, tooltipStyle, tooltipWrapper, tooltipCursor } from "@/lib/charts/theme";
import { useIsMobile } from "@/lib/hooks/use-media-query";

const COLORS = {
  indigo: "#6366f1",
  emerald: "#10b981",
  amber: "#f59e0b",
  red: "#ef4444",
  blue: "#3b82f6",
  purple: "#8b5cf6",
  pink: "#ec4899",
  zinc: "#71717a",
};

const PIE_COLORS = [COLORS.indigo, COLORS.amber, COLORS.emerald, COLORS.red];

interface AdminChartsProps {
  dailyActivity: { date: string; entries: number; tasks: number; avgScore: number }[];
  taskStatuses: Record<string, number>;
  taskPriorities: Record<string, number>;
  entryStatuses: Record<string, number>;
}

export function AdminCharts({ dailyActivity, taskStatuses, taskPriorities, entryStatuses }: AdminChartsProps) {
  const isMobile = useIsMobile();
  const taskStatusData = Object.entries(taskStatuses).map(([name, value]) => ({ name, value }));
  const taskPriorityData = Object.entries(taskPriorities).map(([name, value]) => ({ name, value }));
  const entryStatusData = Object.entries(entryStatuses).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      {/* Activity Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Activity (Last 30 Days)</CardTitle>
          <CardDescription>Entries and tasks created per day</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyActivity} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="adminEntries" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLORS.indigo} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={COLORS.indigo} stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="adminTasks" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLORS.emerald} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={COLORS.emerald} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-700" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: isMobile ? 10 : 11, fill: "currentColor" }}
                  tickMargin={8}
                  interval={isMobile ? 6 : "preserveStartEnd"}
                  angle={isMobile ? -35 : 0}
                  textAnchor={isMobile ? "end" : "middle"}
                  height={isMobile ? 50 : 30}
                  tickFormatter={(v) => new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                />
                <YAxis tick={{ fontSize: isMobile ? 10 : 11, fill: "currentColor" }} width={isMobile ? 28 : 40} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  wrapperStyle={tooltipWrapper}
                  cursor={tooltipCursor}
                  labelFormatter={(v) => new Date(v).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
                />
                {!isMobile && <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />}
                <Area
                  type="monotone"
                  dataKey="entries"
                  stackId="1"
                  stroke={COLORS.indigo}
                  strokeWidth={2}
                  fill="url(#adminEntries)"
                  name="Entries"
                  {...chartAnim}
                />
                <Area
                  type="monotone"
                  dataKey="tasks"
                  stackId="1"
                  stroke={COLORS.emerald}
                  strokeWidth={2}
                  fill="url(#adminTasks)"
                  name="Tasks"
                  {...chartAnim}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Avg Productivity Score Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Productivity Score Trend</CardTitle>
          <CardDescription>Average daily productivity score across all users</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyActivity.filter((d) => d.avgScore > 0)} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="adminAvgScore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLORS.purple} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={COLORS.purple} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-700" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: isMobile ? 10 : 11, fill: "currentColor" }}
                  tickMargin={8}
                  interval={isMobile ? 6 : "preserveStartEnd"}
                  angle={isMobile ? -35 : 0}
                  textAnchor={isMobile ? "end" : "middle"}
                  height={isMobile ? 50 : 30}
                  tickFormatter={(v) => new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                />
                <YAxis domain={[0, 10]} tick={{ fontSize: isMobile ? 10 : 11, fill: "currentColor" }} width={isMobile ? 28 : 40} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  wrapperStyle={tooltipWrapper}
                  cursor={tooltipCursor}
                  labelFormatter={(v) => new Date(v).toLocaleDateString(undefined, { month: "long", day: "numeric" })}
                />
                <Area
                  type="monotone"
                  dataKey="avgScore"
                  stroke={COLORS.purple}
                  strokeWidth={2.5}
                  fill="url(#adminAvgScore)"
                  name="Avg Score"
                  {...chartAnim}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Pie Charts Row */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Task Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <defs>
                    {PIE_COLORS.map((c, i) => (
                      <linearGradient key={i} id={`taskStat-${i}`} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor={c} stopOpacity={0.75} />
                        <stop offset="100%" stopColor={c} stopOpacity={1} />
                      </linearGradient>
                    ))}
                  </defs>
                  <Pie
                    data={taskStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    {...chartAnim}
                  >
                    {taskStatusData.map((_, i) => (
                      <Cell key={i} fill={`url(#taskStat-${i % PIE_COLORS.length})`} stroke="rgb(24 24 27)" strokeWidth={1} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} wrapperStyle={tooltipWrapper} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Task Priority</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={taskPriorityData} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="priBar" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={COLORS.amber} stopOpacity={0.55} />
                      <stop offset="100%" stopColor={COLORS.amber} stopOpacity={1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-700" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "currentColor" }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "currentColor" }} width={60} />
                  <Tooltip contentStyle={tooltipStyle} wrapperStyle={tooltipWrapper} cursor={tooltipCursor} />
                  <Bar dataKey="value" fill="url(#priBar)" radius={[0, 4, 4, 0]} name="Count" {...chartAnim} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Entry Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <defs>
                    {PIE_COLORS.map((c, i) => (
                      <linearGradient key={i} id={`entStat-${i}`} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor={c} stopOpacity={0.75} />
                        <stop offset="100%" stopColor={c} stopOpacity={1} />
                      </linearGradient>
                    ))}
                  </defs>
                  <Pie
                    data={entryStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    {...chartAnim}
                  >
                    {entryStatusData.map((_, i) => (
                      <Cell key={i} fill={`url(#entStat-${i % PIE_COLORS.length})`} stroke="rgb(24 24 27)" strokeWidth={1} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} wrapperStyle={tooltipWrapper} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
