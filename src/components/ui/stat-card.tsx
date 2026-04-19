import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  /** Small icon shown next to the label — pass a coloured Lucide icon. */
  icon?: React.ReactNode;
  /** Short uppercase-cased label above the value. */
  label: string;
  /** Primary number or string — the thing the eye lands on first. */
  value: string | number;
  /** Optional single-line context under the value. */
  sub?: string;
  /** Accent tint applied subtly behind the card — useful on the Dashboard. */
  tone?: "default" | "indigo" | "emerald" | "amber" | "sky" | "rose";
  className?: string;
}

/**
 * Single stat tile used across Today, Dashboard, and analytics surfaces.
 *
 * Replaces the earlier divergence: `/today` had small `text-[11px]` labels
 * in a dense 4-up grid and `/dashboard` had fat bespoke Cards with
 * `text-3xl` values. Both are now this component — one size of tile, so
 * scanning between surfaces doesn't require re-calibrating the eye.
 */
export function StatCard({
  icon,
  label,
  value,
  sub,
  tone = "default",
  className,
}: StatCardProps) {
  const toneBg: Record<NonNullable<StatCardProps["tone"]>, string> = {
    default: "",
    indigo: "border-indigo-200 bg-indigo-50/40 dark:border-indigo-900/40 dark:bg-indigo-950/20",
    emerald: "border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20",
    amber: "border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/20",
    sky: "border-sky-200 bg-sky-50/40 dark:border-sky-900/40 dark:bg-sky-950/20",
    rose: "border-rose-200 bg-rose-50/40 dark:border-rose-900/40 dark:bg-rose-950/20",
  };

  return (
    <Card className={cn(toneBg[tone], className)}>
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {icon}
          <span className="truncate">{label}</span>
        </div>
        <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50 sm:text-[1.75rem]">
          {value}
        </p>
        {sub && (
          <p className="mt-0.5 truncate text-[11px] text-zinc-500 dark:text-zinc-400">
            {sub}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
