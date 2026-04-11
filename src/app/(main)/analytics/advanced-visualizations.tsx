"use client";

import { useEffect, useState } from "react";
import { KPICards } from "@/components/visualizations/kpi-cards";
import { ActivityHeatmap } from "@/components/visualizations/activity-heatmap";
import { StatusDonut } from "@/components/visualizations/status-donut";
import { ProductivityTrend } from "@/components/visualizations/productivity-trend";
import { TeamPerformance } from "@/components/visualizations/team-performance";
import { getKPIData } from "@/lib/visualizations/actions";
import type { KPIData } from "@/lib/visualizations/types";
import { format, subDays } from "date-fns";

interface AdvancedVisualizationsSectionProps {
  workspaceId: string;
}

export function AdvancedVisualizationsSection({ workspaceId }: AdvancedVisualizationsSectionProps) {
  const [kpiData, setKpiData] = useState<KPIData | null>(null);

  useEffect(() => {
    const today = new Date();
    const from = format(subDays(today, 30), "yyyy-MM-dd");
    const to = format(today, "yyyy-MM-dd");

    getKPIData(workspaceId, { from, to })
      .then(setKpiData)
      .catch(() => {});
  }, [workspaceId]);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      {kpiData && <KPICards data={kpiData} />}

      {/* Activity Heatmap */}
      <ActivityHeatmap workspaceId={workspaceId} />

      {/* Status Donut + Productivity Trend side by side */}
      <div className="grid gap-6 lg:grid-cols-2">
        <StatusDonut workspaceId={workspaceId} />
        <ProductivityTrend workspaceId={workspaceId} />
      </div>

      {/* Team Performance */}
      <TeamPerformance workspaceId={workspaceId} />
    </div>
  );
}
