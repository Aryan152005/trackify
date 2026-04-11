"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getProductivityTrend } from "@/lib/visualizations/actions";
import type { ProductivityTrendPoint } from "@/lib/visualizations/types";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";

interface ProductivityTrendProps {
  workspaceId: string;
}

type PeriodKey = "7d" | "30d" | "90d";

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
      <p className="mb-1.5 text-sm font-medium text-zinc-900 dark:text-zinc-100">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-zinc-500 dark:text-zinc-400">{entry.name}:</span>
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            {entry.value !== null && entry.value !== undefined
              ? entry.name.includes("Rate")
                ? `${entry.value.toFixed(0)}%`
                : entry.value.toFixed(1)
              : "N/A"}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ProductivityTrend({ workspaceId }: ProductivityTrendProps) {
  const [data, setData] = useState<ProductivityTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodKey>("30d");

  const periodDays: Record<PeriodKey, number> = { "7d": 7, "30d": 30, "90d": 90 };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getProductivityTrend(workspaceId, periodDays[period]);
      setData(result);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [workspaceId, period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const periods: PeriodKey[] = ["7d", "30d", "90d"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-indigo-500" />
              Productivity Trend
            </CardTitle>
            <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
              {periods.map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium transition-colors",
                    period === p
                      ? "bg-indigo-600 text-white"
                      : "bg-white text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-[300px] animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="prodGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="rateGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-700" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "currentColor", fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  yAxisId="left"
                  domain={[0, 10]}
                  tick={{ fill: "currentColor", fontSize: 11 }}
                  label={{ value: "Score", angle: -90, position: "insideLeft", style: { fill: "currentColor", fontSize: 11 } }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 100]}
                  tick={{ fill: "currentColor", fontSize: 11 }}
                  label={{ value: "Rate %", angle: 90, position: "insideRight", style: { fill: "currentColor", fontSize: 11 } }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="productivity"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#prodGradient)"
                  name="Productivity Score"
                  connectNulls
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2 }}
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="completionRate"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#rateGradient)"
                  name="Completion Rate"
                  connectNulls
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2 }}
                  strokeDasharray="5 3"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
