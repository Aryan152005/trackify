"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getTeamPerformance } from "@/lib/visualizations/actions";
import type { TeamMemberPerformance } from "@/lib/visualizations/types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { motion } from "framer-motion";
import { Users, ArrowUpDown } from "lucide-react";
import { format, subDays } from "date-fns";

interface TeamPerformanceProps {
  workspaceId: string;
}

type SortKey = "tasksCompleted" | "entriesMade" | "hoursLogged" | "avgProductivity";
type RangeKey = "7d" | "30d" | "90d";

export function TeamPerformance({ workspaceId }: TeamPerformanceProps) {
  const [data, setData] = useState<TeamMemberPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortKey>("tasksCompleted");
  const [range, setRange] = useState<RangeKey>("30d");

  const rangeDays: Record<RangeKey, number> = { "7d": 7, "30d": 30, "90d": 90 };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const days = rangeDays[range];
      const from = format(subDays(new Date(), days), "yyyy-MM-dd");
      const to = format(new Date(), "yyyy-MM-dd");
      const result = await getTeamPerformance(workspaceId, { from, to });
      setData(result);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [workspaceId, range]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const sorted = [...data].sort((a, b) => b[sortBy] - a[sortBy]);

  const chartData = sorted.map((m) => ({
    name: m.name.split(" ")[0], // First name for chart readability
    "Tasks Done": m.tasksCompleted,
    "Entries": m.entriesMade,
    "Hours": Math.round(m.hoursLogged * 10) / 10,
  }));

  const sortOptions: { key: SortKey; label: string }[] = [
    { key: "tasksCompleted", label: "Tasks" },
    { key: "entriesMade", label: "Entries" },
    { key: "hoursLogged", label: "Hours" },
    { key: "avgProductivity", label: "Productivity" },
  ];

  const rangeOptions: RangeKey[] = ["7d", "30d", "90d"];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-500" />
            Team Performance
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* Date range filter */}
            <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
              {rangeOptions.map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium transition-colors",
                    range === r
                      ? "bg-indigo-600 text-white"
                      : "bg-white text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
            {/* Sort */}
            <div className="flex items-center gap-1">
              <ArrowUpDown className="h-3.5 w-3.5 text-zinc-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
              >
                {sortOptions.map((o) => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-[300px] animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
        ) : data.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-zinc-400 dark:text-zinc-500">
            No team data available
          </div>
        ) : (
          <div className="space-y-6">
            {/* Chart */}
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-700" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "currentColor", fontSize: 12 }}
                  className="text-zinc-600 dark:text-zinc-400"
                />
                <YAxis tick={{ fill: "currentColor", fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-white, #fff)",
                    border: "1px solid #e4e4e7",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  wrapperClassName="dark:[&_.recharts-tooltip-wrapper]:!bg-zinc-800"
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Bar dataKey="Tasks Done" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Entries" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Hours" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>

            {/* Member list */}
            <div className="space-y-2">
              {sorted.map((member, i) => (
                <motion.div
                  key={member.userId}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 rounded-lg border border-zinc-100 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-800/50"
                >
                  {/* Avatar */}
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400">
                    {member.avatarUrl ? (
                      <img src={member.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                      member.name.charAt(0).toUpperCase()
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900 truncate dark:text-zinc-100">
                      {member.name}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                    <div className="text-center">
                      <p className="font-semibold text-indigo-600 dark:text-indigo-400">{member.tasksCompleted}</p>
                      <p>tasks</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-purple-600 dark:text-purple-400">{member.entriesMade}</p>
                      <p>entries</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {member.hoursLogged.toFixed(1)}h
                      </p>
                      <p>hours</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-amber-600 dark:text-amber-400">
                        {member.avgProductivity}
                      </p>
                      <p>avg</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
