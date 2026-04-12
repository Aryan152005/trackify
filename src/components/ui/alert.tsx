import { cn } from "@/lib/utils";

type Variant = "success" | "warn" | "error" | "info";

const STYLES: Record<Variant, string> = {
  success: "bg-green-50 text-green-800 border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-900/50",
  warn: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/50",
  error: "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900/50",
  info: "bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-900/50",
};

export function Alert({
  type,
  children,
  className,
}: {
  type: Variant;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role={type === "error" ? "alert" : "status"}
      className={cn(
        "rounded-lg border px-3 py-2 text-sm",
        STYLES[type],
        className
      )}
    >
      {children}
    </div>
  );
}
