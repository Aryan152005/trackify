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
import { chartAnim, tooltipStyle, tooltipWrapper, tooltipCursor, activeDot } from "@/lib/charts/theme";
import { useIsMobile } from "@/lib/hooks/use-media-query";

interface AnalyticsChartsProps {
  entries: Array<{
    date: string;
    productivity_score: number | null;
    status: string;
  }>;
}

export function AnalyticsCharts({ entries }: AnalyticsChartsProps) {
  const isMobile = useIsMobile();
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
        <div className="h-[260px] sm:h-[320px] lg:h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="strokeScore" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-700" />
            <XAxis
              dataKey="date"
              className="text-xs"
              tick={{ fill: "currentColor", fontSize: isMobile ? 10 : 12 }}
              tickMargin={8}
              interval={isMobile ? 6 : "preserveStartEnd"}
              angle={isMobile ? -35 : 0}
              textAnchor={isMobile ? "end" : "middle"}
              height={isMobile ? 50 : 30}
            />
            <YAxis domain={[0, 10]} className="text-xs" tick={{ fill: "currentColor", fontSize: isMobile ? 10 : 12 }} width={isMobile ? 28 : 40} />
            <Tooltip contentStyle={tooltipStyle} wrapperStyle={tooltipWrapper} cursor={tooltipCursor} />
            {!isMobile && <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />}
            <Area
              type="monotone"
              dataKey="score"
              stroke="url(#strokeScore)"
              fillOpacity={1}
              fill="url(#colorScore)"
              name="Avg Score"
              strokeWidth={2.5}
              activeDot={activeDot}
              {...chartAnim}
            />
            <Line
              type="monotone"
              dataKey="entries"
              stroke="#8b5cf6"
              strokeWidth={2.5}
              dot={false}
              activeDot={activeDot}
              name="Entries"
              {...chartAnim}
            />
          </AreaChart>
        </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
