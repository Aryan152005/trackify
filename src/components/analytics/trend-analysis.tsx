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
import { chartAnim, tooltipStyle, tooltipWrapper, tooltipCursor, activeDot } from "@/lib/charts/theme";
import { useIsMobile } from "@/lib/hooks/use-media-query";

interface TrendAnalysisProps {
  entries: Array<{
    date: string;
    productivity_score: number | null;
    status: string;
  }>;
}

export function TrendAnalysis({ entries }: TrendAnalysisProps) {
  const isMobile = useIsMobile();
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
        <div className="h-[260px] sm:h-[320px] lg:h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={weeklyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gTrendScore" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
              <linearGradient id="gTrendComp" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#34d399" />
              </linearGradient>
              <linearGradient id="gTrendEntries" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#fbbf24" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-700" />
            <XAxis
              dataKey="week"
              className="text-xs"
              tick={{ fill: "currentColor", fontSize: isMobile ? 10 : 12 }}
              tickMargin={8}
              interval={isMobile ? 1 : "preserveStartEnd"}
              angle={isMobile ? -35 : 0}
              textAnchor={isMobile ? "end" : "middle"}
              height={isMobile ? 50 : 30}
            />
            <YAxis className="text-xs" tick={{ fill: "currentColor", fontSize: isMobile ? 10 : 12 }} width={isMobile ? 28 : 40} />
            <Tooltip contentStyle={tooltipStyle} wrapperStyle={tooltipWrapper} cursor={tooltipCursor} />
            {!isMobile && <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />}
            <Line
              type="monotone"
              dataKey="score"
              stroke="url(#gTrendScore)"
              strokeWidth={2.5}
              dot={false}
              activeDot={activeDot}
              name="Avg Score"
              {...chartAnim}
            />
            <Line
              type="monotone"
              dataKey="completionRate"
              stroke="url(#gTrendComp)"
              strokeWidth={2.5}
              dot={false}
              activeDot={activeDot}
              name="Completion %"
              {...chartAnim}
            />
            <Line
              type="monotone"
              dataKey="entries"
              stroke="url(#gTrendEntries)"
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
  );
}
