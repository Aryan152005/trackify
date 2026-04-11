"use client";

import { useEffect, useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { motion } from "framer-motion";
import type { KPIData, KPIMetric } from "@/lib/visualizations/types";

interface KPICardsProps {
  data: KPIData;
}

function AnimatedNumber({ value, decimals = 0, suffix = "" }: { value: number; decimals?: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number | null>(null);

  useEffect(() => {
    const duration = 1200;
    const start = performance.now();
    const from = 0;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (value - from) * eased);
      if (progress < 1) {
        ref.current = requestAnimationFrame(tick);
      }
    }

    ref.current = requestAnimationFrame(tick);
    return () => {
      if (ref.current) cancelAnimationFrame(ref.current);
    };
  }, [value]);

  return (
    <span>
      {display.toFixed(decimals)}{suffix}
    </span>
  );
}

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1);
  const height = 32;
  const width = 80;
  const step = width / (data.length - 1 || 1);

  const points = data.map((v, i) => {
    const x = i * step;
    const y = height - (v / max) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(" ");

  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`spark-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#spark-${color})`} />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const CARD_CONFIGS: { key: keyof KPIData; color: string; gradient: string; iconColor: string }[] = [
  {
    key: "taskCompletionRate",
    color: "#6366f1",
    gradient: "from-indigo-500/10 to-indigo-600/5 dark:from-indigo-500/20 dark:to-indigo-600/10",
    iconColor: "text-indigo-500",
  },
  {
    key: "avgProductivity",
    color: "#8b5cf6",
    gradient: "from-purple-500/10 to-purple-600/5 dark:from-purple-500/20 dark:to-purple-600/10",
    iconColor: "text-purple-500",
  },
  {
    key: "activeStreak",
    color: "#f59e0b",
    gradient: "from-amber-500/10 to-amber-600/5 dark:from-amber-500/20 dark:to-amber-600/10",
    iconColor: "text-amber-500",
  },
  {
    key: "totalHours",
    color: "#10b981",
    gradient: "from-emerald-500/10 to-emerald-600/5 dark:from-emerald-500/20 dark:to-emerald-600/10",
    iconColor: "text-emerald-500",
  },
  {
    key: "entriesThisWeek",
    color: "#ec4899",
    gradient: "from-pink-500/10 to-pink-600/5 dark:from-pink-500/20 dark:to-pink-600/10",
    iconColor: "text-pink-500",
  },
];

function KPICard({ metric, config, index }: { metric: KPIMetric; config: typeof CARD_CONFIGS[0]; index: number }) {
  const isPercentage = metric.formattedValue.endsWith("%");
  const isHours = metric.formattedValue.endsWith("h");
  const isDecimal = metric.formattedValue.includes(".") && !isHours;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
    >
      <Card className={cn(
        "relative overflow-hidden bg-gradient-to-br p-5 transition-shadow hover:shadow-lg",
        config.gradient
      )}>
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              {metric.label}
            </p>
            <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
              {isPercentage ? (
                <AnimatedNumber value={metric.value} suffix="%" />
              ) : isHours ? (
                <AnimatedNumber value={metric.value} decimals={1} suffix="h" />
              ) : isDecimal ? (
                <AnimatedNumber value={metric.value} decimals={1} />
              ) : (
                <AnimatedNumber value={metric.value} />
              )}
            </p>
            {metric.change !== 0 && (
              <div className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                metric.trend === "up"
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                  : metric.trend === "down"
                  ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                  : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
              )}>
                {metric.trend === "up" ? (
                  <TrendingUp className="h-3 w-3" />
                ) : metric.trend === "down" ? (
                  <TrendingDown className="h-3 w-3" />
                ) : (
                  <Minus className="h-3 w-3" />
                )}
                {Math.abs(metric.change)}%
              </div>
            )}
          </div>
          <div className="opacity-60">
            <MiniSparkline data={metric.sparkline} color={config.color} />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

export function KPICards({ data }: KPICardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {CARD_CONFIGS.map((config, i) => (
        <KPICard
          key={config.key}
          metric={data[config.key]}
          config={config}
          index={i}
        />
      ))}
    </div>
  );
}
