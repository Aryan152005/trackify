"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface TagPerformanceProps {
  entries: Array<{
    entry_tags?: Array<{ tags: { name: string; color: string } | null }>;
    productivity_score: number | null;
  }>;
  tags: Array<{ id: string; name: string; color: string }>;
}

export function TagPerformance({ entries, tags }: TagPerformanceProps) {
  // Calculate tag performance
  const tagStats = tags.map((tag) => {
    const tagEntries = entries.filter((entry) =>
      entry.entry_tags?.some((et) => et.tags?.name === tag.name)
    );
    const scores = tagEntries
      .map((e) => e.productivity_score)
      .filter((s): s is number => s !== null);
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

    return {
      name: tag.name,
      entries: tagEntries.length,
      avgScore: avgScore.toFixed(1),
      color: tag.color,
    };
  }).filter((t) => t.entries > 0).sort((a, b) => b.entries - a.entries).slice(0, 10);

  return (
    <Card className="border-2 border-purple-200 dark:border-purple-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
          <span className="h-2 w-2 rounded-full bg-purple-500"></span>
          Tag Performance
        </CardTitle>
        <CardDescription>Most used tags and their productivity scores</CardDescription>
      </CardHeader>
      <CardContent>
        {tagStats.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={tagStats} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-700" />
              <XAxis type="number" className="text-xs" tick={{ fill: "currentColor" }} />
              <YAxis
                dataKey="name"
                type="category"
                width={100}
                className="text-xs"
                tick={{ fill: "currentColor" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--background)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                }}
                formatter={(value: number) => [`${value} entries`, "Count"]}
              />
              <Bar dataKey="entries" radius={[0, 8, 8, 0]}>
                {tagStats.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-[300px] items-center justify-center text-zinc-500 dark:text-zinc-400">
            No tag data available
          </div>
        )}
      </CardContent>
    </Card>
  );
}
