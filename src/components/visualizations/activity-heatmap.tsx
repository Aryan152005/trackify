"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getActivityHeatmap } from "@/lib/visualizations/actions";
import type { ActivityHeatmap as ActivityHeatmapType, HeatmapDay } from "@/lib/visualizations/types";
import { format, getDay, startOfYear, addDays, getWeek } from "date-fns";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Flame } from "lucide-react";

interface ActivityHeatmapProps {
  workspaceId: string;
  onDateClick?: (date: string) => void;
}

const LEVEL_COLORS = [
  "bg-zinc-100 dark:bg-zinc-800",          // 0 - no activity
  "bg-indigo-200 dark:bg-indigo-900/60",    // 1
  "bg-indigo-300 dark:bg-indigo-700/70",    // 2
  "bg-indigo-500 dark:bg-indigo-500/80",    // 3
  "bg-indigo-700 dark:bg-indigo-400",       // 4
];

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

export function ActivityHeatmap({ workspaceId, onDateClick }: ActivityHeatmapProps) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<ActivityHeatmapType | null>(null);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<{ day: HeatmapDay; x: number; y: number } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getActivityHeatmap(workspaceId, year);
      setData(result);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [workspaceId, year]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-indigo-500" />
            Activity Heatmap
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[160px] animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
        </CardContent>
      </Card>
    );
  }

  // Build weeks grid
  const yearStart = startOfYear(new Date(year, 0, 1));
  const firstDayOffset = getDay(yearStart); // 0=Sun
  // Adjust so Monday=0
  const mondayOffset = firstDayOffset === 0 ? 6 : firstDayOffset - 1;

  // Build a map for quick lookup
  const dayMap = new Map<string, HeatmapDay>();
  data.days.forEach((d) => dayMap.set(d.date, d));

  // Create 53 weeks x 7 days grid
  const weeks: (HeatmapDay | null)[][] = [];
  let currentDate = addDays(yearStart, -mondayOffset);

  for (let w = 0; w < 53; w++) {
    const week: (HeatmapDay | null)[] = [];
    for (let d = 0; d < 7; d++) {
      const dateStr = format(currentDate, "yyyy-MM-dd");
      const heatDay = dayMap.get(dateStr);
      if (currentDate.getFullYear() === year) {
        week.push(heatDay || { date: dateStr, count: 0, level: 0 });
      } else {
        week.push(null);
      }
      currentDate = addDays(currentDate, 1);
    }
    weeks.push(week);
  }

  // Calculate month label positions
  const monthPositions: { label: string; col: number }[] = [];
  let prevMonth = -1;
  weeks.forEach((week, wi) => {
    const firstValid = week.find((d) => d !== null);
    if (firstValid) {
      const month = new Date(firstValid.date).getMonth();
      if (month !== prevMonth) {
        monthPositions.push({ label: MONTH_LABELS[month], col: wi });
        prevMonth = month;
      }
    }
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-indigo-500" />
            Activity Heatmap
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              {data.totalActivities} activities in {year}
            </span>
            <button
              onClick={() => setYear((y) => y - 1)}
              className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{year}</span>
            <button
              onClick={() => setYear((y) => Math.min(y + 1, new Date().getFullYear()))}
              className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              disabled={year >= new Date().getFullYear()}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="inline-block min-w-[720px]">
            {/* Month labels */}
            <div className="flex ml-8 mb-1">
              {monthPositions.map((mp, i) => (
                <div
                  key={mp.label + i}
                  className="text-xs text-zinc-400 dark:text-zinc-500"
                  style={{
                    position: "relative",
                    left: `${mp.col * 14}px`,
                    marginRight: i < monthPositions.length - 1
                      ? `${((monthPositions[i + 1]?.col || 53) - mp.col) * 14 - 30}px`
                      : 0,
                  }}
                >
                  {mp.label}
                </div>
              ))}
            </div>

            {/* Grid */}
            <div className="flex gap-0">
              {/* Day labels */}
              <div className="flex flex-col gap-[3px] mr-2 pt-0">
                {DAY_LABELS.map((label, i) => (
                  <div key={i} className="h-[12px] text-[10px] leading-[12px] text-zinc-400 dark:text-zinc-500 w-6 text-right pr-1">
                    {label}
                  </div>
                ))}
              </div>

              {/* Weeks */}
              <div className="flex gap-[3px] relative">
                {weeks.map((week, wi) => (
                  <div key={wi} className="flex flex-col gap-[3px]">
                    {week.map((day, di) => (
                      <motion.div
                        key={`${wi}-${di}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: wi * 0.005 }}
                        className={cn(
                          "h-[12px] w-[12px] rounded-sm cursor-pointer transition-all",
                          day ? LEVEL_COLORS[day.level] : "bg-transparent",
                          day && "hover:ring-2 hover:ring-indigo-400 hover:ring-offset-1 dark:hover:ring-offset-zinc-900"
                        )}
                        onMouseEnter={(e) => {
                          if (day) {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setTooltip({ day, x: rect.left + rect.width / 2, y: rect.top });
                          }
                        }}
                        onMouseLeave={() => setTooltip(null)}
                        onClick={() => {
                          if (day && onDateClick) onDateClick(day.date);
                        }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-end gap-2 mt-3">
              <span className="text-xs text-zinc-400 dark:text-zinc-500">Less</span>
              {LEVEL_COLORS.map((color, i) => (
                <div key={i} className={cn("h-[12px] w-[12px] rounded-sm", color)} />
              ))}
              <span className="text-xs text-zinc-400 dark:text-zinc-500">More</span>
            </div>
          </div>
        </div>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="fixed z-50 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-800 pointer-events-none"
            style={{
              left: tooltip.x,
              top: tooltip.y - 40,
              transform: "translateX(-50%)",
            }}
          >
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {tooltip.day.count} {tooltip.day.count === 1 ? "activity" : "activities"}
            </span>
            <span className="text-zinc-500 dark:text-zinc-400"> on {format(new Date(tooltip.day.date), "MMM d, yyyy")}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
