import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogService =
  | "email"
  | "auth"
  | "admin"
  | "cron"
  | "api"
  | "database"
  | "workspace"
  | "integration"
  | "other";

export interface LogEventArgs {
  service: LogService;
  level: LogLevel;
  tag?: string;
  message: string;
  metadata?: Record<string, unknown>;
  userId?: string | null;
  workspaceId?: string | null;
}

/**
 * Write a single system log entry. Fire-and-forget safe:
 * failures are caught + dumped to console so logging can never break a request.
 */
export async function logEvent(args: LogEventArgs): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("system_logs").insert({
      service: args.service,
      level: args.level,
      tag: args.tag ?? null,
      message: args.message,
      metadata: args.metadata ?? {},
      user_id: args.userId ?? null,
      workspace_id: args.workspaceId ?? null,
    });
  } catch (err) {
    // Never throw from the logger — swallow and console-log so we have a trail
    // even when the DB write fails.
    // eslint-disable-next-line no-console
    console.error("[logger] Failed to write log:", err, args);
  }
}

/**
 * Convenience wrapper: run an async operation, log success/failure to system_logs,
 * and rethrow so callers still see the error. Useful to instrument server actions.
 */
export async function withLog<T>(
  args: Omit<LogEventArgs, "level" | "message"> & {
    successMessage?: string;
    failureMessage?: string;
  },
  fn: () => Promise<T>
): Promise<T> {
  const started = Date.now();
  try {
    const result = await fn();
    await logEvent({
      service: args.service,
      tag: args.tag,
      level: "info",
      message: args.successMessage ?? `${args.tag ?? "operation"} succeeded`,
      metadata: { ...args.metadata, durationMs: Date.now() - started },
      userId: args.userId,
      workspaceId: args.workspaceId,
    });
    return result;
  } catch (err) {
    await logEvent({
      service: args.service,
      tag: args.tag,
      level: "error",
      message:
        args.failureMessage ??
        (err instanceof Error ? err.message : `${args.tag ?? "operation"} failed`),
      metadata: {
        ...args.metadata,
        durationMs: Date.now() - started,
        error: err instanceof Error ? err.message : String(err),
      },
      userId: args.userId,
      workspaceId: args.workspaceId,
    });
    throw err;
  }
}
