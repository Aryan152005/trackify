"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getStatusDistribution } from "@/lib/visualizations/actions";
import type { StatusDistribution } from "@/lib/visualizations/types";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Sector } from "recharts";
import { motion } from "framer-motion";
import { PieChart as PieIcon } from "lucide-react";

interface StatusDonutProps {
  workspaceId: string;
  onStatusClick?: (status: string) => void;
}

type ViewMode = "tasks" | "entries";

function renderActiveShape(props: any) {
  const {
    cx, cy, innerRadius, outerRadius, startAngle, endAngle,
    fill, payload, percent, value,
  } = props;

  return (
    <g>
      <text x={cx} y={cy - 8} textAnchor="middle" className="fill-zinc-900 dark:fill-zinc-100 text-lg font-bold">
        {value}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" className="fill-zinc-500 dark:fill-zinc-400 text-xs">
        {payload.status}
      </text>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <Sector
        cx={cx}
        cy={cy}
        startAngle={startAngle}
        endAngle={endAngle}
        innerRadius={outerRadius + 8}
        outerRadius={outerRadius + 12}
        fill={fill}
        opacity={0.4}
      />
    </g>
  );
}

export function StatusDonut({ workspaceId, onStatusClick }: StatusDonutProps) {
  const [data, setData] = useState<StatusDistribution | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("tasks");
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getStatusDistribution(workspaceId);
      setData(result);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const chartData = data ? (view === "tasks" ? data.tasks : data.entries) : [];
  const total = chartData.reduce((s, d) => s + d.count, 0);

  const statusLabels: Record<string, string> = {
    pending: "Pending",
    "in-progress": "In Progress",
    done: "Done",
    cancelled: "Cancelled",
    blocked: "Blocked",
  };

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
              <PieIcon className="h-5 w-5 text-indigo-500" />
              Status Distribution
            </CardTitle>
            <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
              {(["tasks", "entries"] as ViewMode[]).map((v) => (
                <button
                  key={v}
                  onClick={() => { setView(v); setActiveIndex(undefined); }}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                    view === v
                      ? "bg-indigo-600 text-white"
                      : "bg-white text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-[300px] animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
          ) : chartData.length === 0 ? (
            <div className="flex h-[300px] items-center justify-center text-zinc-400">
              No data available
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              {/* Chart */}
              <div className="relative h-[250px] w-[250px] flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      activeIndex={activeIndex}
                      activeShape={renderActiveShape}
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="count"
                      onMouseEnter={(_, index) => setActiveIndex(index)}
                      onMouseLeave={() => setActiveIndex(undefined)}
                      onClick={(entry) => {
                        if (onStatusClick) onStatusClick(entry.status);
                      }}
                      animationBegin={0}
                      animationDuration={800}
                      animationEasing="ease-out"
                    >
                      {chartData.map((entry, i) => (
                        <Cell
                          key={entry.status}
                          fill={entry.color}
                          className="cursor-pointer"
                          stroke="transparent"
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [`${value} (${total > 0 ? ((value / total) * 100).toFixed(0) : 0}%)`, "Count"]}
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid #e4e4e7",
                        fontSize: "12px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center label */}
                {activeIndex === undefined && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{total}</span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">total</span>
                  </div>
                )}
              </div>

              {/* Legend */}
              <div className="flex flex-col gap-2 flex-1">
                {chartData.map((item) => (
                  <button
                    key={item.status}
                    onClick={() => onStatusClick?.(item.status)}
                    className="flex items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    <div
                      className="h-3 w-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        {statusLabels[item.status] || item.status}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{item.count}</p>
                      <p className="text-xs text-zinc-400">
                        {total > 0 ? ((item.count / total) * 100).toFixed(0) : 0}%
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
