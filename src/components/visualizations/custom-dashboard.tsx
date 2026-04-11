"use client";

import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { saveDashboardWidgets } from "@/lib/visualizations/actions";
import type { DashboardWidget, KPIData, WidgetType } from "@/lib/visualizations/types";
import { KPICards } from "./kpi-cards";
import { ActivityHeatmap } from "./activity-heatmap";
import { StatusDonut } from "./status-donut";
import { ProductivityTrend } from "./productivity-trend";
import { TeamPerformance } from "./team-performance";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  X,
  GripVertical,
  BarChart3,
  Flame,
  PieChart,
  TrendingUp,
  Users,
  Activity,
  Calendar,
  Save,
  RotateCcw,
  Eye,
  Pencil,
} from "lucide-react";

interface CustomDashboardProps {
  workspaceId: string;
  userId: string;
}

const STORAGE_KEY = "wis-dashboard-layout";

const WIDGET_CATALOG: {
  type: WidgetType;
  label: string;
  description: string;
  icon: React.ReactNode;
  defaultSize: { w: number; h: number };
}[] = [
  {
    type: "kpi-cards",
    label: "KPI Cards",
    description: "Key performance indicators with trends",
    icon: <BarChart3 className="h-5 w-5" />,
    defaultSize: { w: 4, h: 1 },
  },
  {
    type: "activity-heatmap",
    label: "Activity Heatmap",
    description: "GitHub-style contribution heatmap",
    icon: <Flame className="h-5 w-5" />,
    defaultSize: { w: 4, h: 1 },
  },
  {
    type: "status-donut",
    label: "Status Distribution",
    description: "Donut chart of task/entry statuses",
    icon: <PieChart className="h-5 w-5" />,
    defaultSize: { w: 2, h: 1 },
  },
  {
    type: "productivity-trend",
    label: "Productivity Trend",
    description: "Multi-line productivity chart over time",
    icon: <TrendingUp className="h-5 w-5" />,
    defaultSize: { w: 2, h: 1 },
  },
  {
    type: "team-performance",
    label: "Team Performance",
    description: "Per-member performance comparison",
    icon: <Users className="h-5 w-5" />,
    defaultSize: { w: 4, h: 1 },
  },
  {
    type: "recent-activity",
    label: "Recent Activity",
    description: "Latest actions feed",
    icon: <Activity className="h-5 w-5" />,
    defaultSize: { w: 2, h: 1 },
  },
  {
    type: "calendar-mini",
    label: "Calendar Mini",
    description: "Compact calendar overview",
    icon: <Calendar className="h-5 w-5" />,
    defaultSize: { w: 2, h: 1 },
  },
];

const DEFAULT_WIDGETS: DashboardWidget[] = [
  { id: "w1", type: "kpi-cards", position: { x: 0, y: 0 }, size: { w: 4, h: 1 }, config: {} },
  { id: "w2", type: "activity-heatmap", position: { x: 0, y: 1 }, size: { w: 4, h: 1 }, config: {} },
  { id: "w3", type: "status-donut", position: { x: 0, y: 2 }, size: { w: 2, h: 1 }, config: {} },
  { id: "w4", type: "productivity-trend", position: { x: 2, y: 2 }, size: { w: 2, h: 1 }, config: {} },
  { id: "w5", type: "team-performance", position: { x: 0, y: 3 }, size: { w: 4, h: 1 }, config: {} },
];

function RecentActivityWidget() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 text-indigo-500" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {[
            { text: "Task completed", time: "2m ago", color: "bg-emerald-500" },
            { text: "New entry added", time: "15m ago", color: "bg-indigo-500" },
            { text: "Timer session ended", time: "1h ago", color: "bg-amber-500" },
            { text: "Note updated", time: "2h ago", color: "bg-purple-500" },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={cn("h-2 w-2 rounded-full", item.color)} />
              <span className="text-sm text-zinc-700 dark:text-zinc-300 flex-1">{item.text}</span>
              <span className="text-xs text-zinc-400">{item.time}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CalendarMiniWidget() {
  const today = new Date();
  const month = today.getMonth();
  const year = today.getFullYear();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = firstDay === 0 ? 6 : firstDay - 1; // Monday-based

  const monthName = today.toLocaleString("default", { month: "long" });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="h-4 w-4 text-indigo-500" />
          {monthName} {year}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 text-center">
          {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
            <div key={d} className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 pb-1">{d}</div>
          ))}
          {Array.from({ length: offset }).map((_, i) => (
            <div key={`e-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const isToday = day === today.getDate();
            return (
              <div
                key={day}
                className={cn(
                  "aspect-square flex items-center justify-center rounded-md text-xs",
                  isToday
                    ? "bg-indigo-600 text-white font-bold"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                )}
              >
                {day}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// Placeholder KPI data for dashboard preview
function KPIPlaceholder({ workspaceId }: { workspaceId: string }) {
  const [data, setData] = useState<KPIData | null>(null);

  useEffect(() => {
    import("@/lib/visualizations/actions").then(async (mod) => {
      try {
        const today = new Date();
        const from = new Date(today);
        from.setDate(from.getDate() - 30);
        const result = await mod.getKPIData(workspaceId, {
          from: from.toISOString().split("T")[0],
          to: today.toISOString().split("T")[0],
        });
        setData(result);
      } catch {
        // silently fail
      }
    });
  }, [workspaceId]);

  if (!data) {
    return <div className="h-[120px] animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />;
  }

  return <KPICards data={data} />;
}

function WidgetRenderer({ widget, workspaceId }: { widget: DashboardWidget; workspaceId: string }) {
  switch (widget.type) {
    case "kpi-cards":
      return <KPIPlaceholder workspaceId={workspaceId} />;
    case "activity-heatmap":
      return <ActivityHeatmap workspaceId={workspaceId} />;
    case "status-donut":
      return <StatusDonut workspaceId={workspaceId} />;
    case "productivity-trend":
      return <ProductivityTrend workspaceId={workspaceId} />;
    case "team-performance":
      return <TeamPerformance workspaceId={workspaceId} />;
    case "recent-activity":
      return <RecentActivityWidget />;
    case "calendar-mini":
      return <CalendarMiniWidget />;
    default:
      return <div className="p-4 text-zinc-400">Unknown widget</div>;
  }
}

export function CustomDashboard({ workspaceId, userId }: CustomDashboardProps) {
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  // Load layout from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY}-${workspaceId}-${userId}`);
      if (stored) {
        setWidgets(JSON.parse(stored));
      } else {
        setWidgets(DEFAULT_WIDGETS);
      }
    } catch {
      setWidgets(DEFAULT_WIDGETS);
    }
  }, [workspaceId, userId]);

  const addWidget = (type: WidgetType) => {
    const catalog = WIDGET_CATALOG.find((w) => w.type === type);
    if (!catalog) return;

    const maxY = widgets.reduce((max, w) => Math.max(max, w.position.y + w.size.h), 0);
    const newWidget: DashboardWidget = {
      id: `w-${Date.now()}`,
      type,
      position: { x: 0, y: maxY },
      size: catalog.defaultSize,
      config: {},
    };
    setWidgets((prev) => [...prev, newWidget]);
    setShowPicker(false);
  };

  const removeWidget = (id: string) => {
    setWidgets((prev) => prev.filter((w) => w.id !== id));
  };

  const moveWidget = (id: string, direction: "up" | "down") => {
    setWidgets((prev) => {
      const idx = prev.findIndex((w) => w.id === id);
      if (idx < 0) return prev;
      if (direction === "up" && idx === 0) return prev;
      if (direction === "down" && idx === prev.length - 1) return prev;

      const next = [...prev];
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return next;
    });
  };

  const saveLayout = async () => {
    setSaving(true);
    try {
      localStorage.setItem(`${STORAGE_KEY}-${workspaceId}-${userId}`, JSON.stringify(widgets));
      await saveDashboardWidgets(workspaceId, userId, widgets);
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  };

  const resetLayout = () => {
    setWidgets(DEFAULT_WIDGETS);
    localStorage.removeItem(`${STORAGE_KEY}-${workspaceId}-${userId}`);
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;

    setWidgets((prev) => {
      const fromIdx = prev.findIndex((w) => w.id === draggedId);
      const toIdx = prev.findIndex((w) => w.id === targetId);
      if (fromIdx < 0 || toIdx < 0) return prev;

      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  };

  const handleDragEnd = () => {
    setDraggedId(null);
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setIsEditing(!isEditing)}
            variant="outline"
            size="sm"
            className={cn(
              isEditing && "border-indigo-500 text-indigo-600 dark:text-indigo-400"
            )}
          >
            {isEditing ? (
              <>
                <Eye className="mr-1.5 h-4 w-4" />
                Preview
              </>
            ) : (
              <>
                <Pencil className="mr-1.5 h-4 w-4" />
                Customize
              </>
            )}
          </Button>
          {isEditing && (
            <Button onClick={() => setShowPicker(true)} variant="outline" size="sm">
              <Plus className="mr-1.5 h-4 w-4" />
              Add Widget
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isEditing && (
            <>
              <Button onClick={resetLayout} variant="ghost" size="sm">
                <RotateCcw className="mr-1.5 h-4 w-4" />
                Reset
              </Button>
              <Button onClick={saveLayout} size="sm" disabled={saving}>
                <Save className="mr-1.5 h-4 w-4" />
                {saving ? "Saving..." : "Save Layout"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Widget Picker Modal */}
      <AnimatePresence>
        {showPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setShowPicker(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Add Widget</h2>
                <button
                  onClick={() => setShowPicker(false)}
                  className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {WIDGET_CATALOG.map((w) => {
                  const alreadyAdded = widgets.some((ww) => ww.type === w.type);
                  return (
                    <button
                      key={w.type}
                      onClick={() => !alreadyAdded && addWidget(w.type)}
                      disabled={alreadyAdded}
                      className={cn(
                        "flex items-start gap-3 rounded-xl border p-4 text-left transition-all",
                        alreadyAdded
                          ? "border-zinc-100 bg-zinc-50 opacity-50 cursor-not-allowed dark:border-zinc-800 dark:bg-zinc-800/50"
                          : "border-zinc-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-indigo-600 dark:hover:bg-indigo-900/20"
                      )}
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400">
                        {w.icon}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{w.label}</p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{w.description}</p>
                        {alreadyAdded && (
                          <p className="text-xs text-indigo-500 mt-1">Already added</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Widget Grid */}
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {widgets.map((widget) => {
            const isFullWidth = widget.size.w >= 4;
            return (
              <motion.div
                key={widget.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                draggable={isEditing}
                onDragStart={(e) => handleDragStart(e as unknown as React.DragEvent, widget.id)}
                onDragOver={(e) => handleDragOver(e as unknown as React.DragEvent, widget.id)}
                onDragEnd={handleDragEnd}
                className={cn(
                  "relative",
                  isEditing && "cursor-grab active:cursor-grabbing",
                  draggedId === widget.id && "opacity-50"
                )}
              >
                {/* Edit overlay */}
                {isEditing && (
                  <div className="absolute -top-2 -right-2 z-10 flex items-center gap-1">
                    <button
                      onClick={() => moveWidget(widget.id, "up")}
                      className="rounded-full border border-zinc-200 bg-white p-1 text-zinc-400 shadow-sm hover:bg-zinc-50 hover:text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                      title="Move up"
                    >
                      <GripVertical className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => removeWidget(widget.id)}
                      className="rounded-full border border-red-200 bg-white p-1 text-red-400 shadow-sm hover:bg-red-50 hover:text-red-600 dark:border-red-800 dark:bg-zinc-800 dark:hover:bg-red-900/30"
                      title="Remove widget"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}

                {isEditing && (
                  <div className="absolute inset-0 z-[5] rounded-2xl border-2 border-dashed border-indigo-300 dark:border-indigo-700 pointer-events-none" />
                )}

                <WidgetRenderer widget={widget} workspaceId={workspaceId} />
              </motion.div>
            );
          })}
        </AnimatePresence>

        {widgets.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 py-16 dark:border-zinc-700">
            <BarChart3 className="h-12 w-12 text-zinc-300 dark:text-zinc-600 mb-3" />
            <p className="text-zinc-500 dark:text-zinc-400 mb-3">No widgets added yet</p>
            <Button onClick={() => setShowPicker(true)} variant="outline" size="sm">
              <Plus className="mr-1.5 h-4 w-4" />
              Add your first widget
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
