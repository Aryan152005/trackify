"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Filter,
  RefreshCw,
} from "lucide-react";
import { useWorkspaceId } from "@/lib/workspace/hooks";
import { getIntegrationLogs } from "@/lib/integrations/actions";
import type { IntegrationLog, IntegrationLogStatus } from "@/lib/integrations/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface IntegrationLogsProps {
  integrationId?: string | null;
}

const STATUS_CONFIG: Record<
  IntegrationLogStatus,
  { icon: React.ElementType; className: string; label: string }
> = {
  success: {
    icon: CheckCircle2,
    className:
      "text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30",
    label: "Success",
  },
  error: {
    icon: XCircle,
    className:
      "text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30",
    label: "Error",
  },
  pending: {
    icon: Clock,
    className:
      "text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30",
    label: "Pending",
  },
};

export function IntegrationLogs({ integrationId }: IntegrationLogsProps) {
  const workspaceId = useWorkspaceId();
  const [logs, setLogs] = useState<IntegrationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");

  const fetchLogs = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const data = await getIntegrationLogs(
        integrationId ?? null,
        workspaceId,
        100
      );
      setLogs(data);
    } catch {
      // handle error
    }
    setLoading(false);
  }, [workspaceId, integrationId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Apply filters
  const filteredLogs = logs.filter((log) => {
    if (filterStatus !== "all" && log.status !== filterStatus) return false;
    if (filterType !== "all" && log.event_type !== filterType) return false;
    return true;
  });

  // Unique event types for filter
  const eventTypes = Array.from(new Set(logs.map((l) => l.event_type)));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Integration Logs
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {filteredLogs.length} event{filteredLogs.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Status filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-zinc-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
            >
              <option value="all">All statuses</option>
              <option value="success">Success</option>
              <option value="error">Error</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          {/* Type filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
          >
            <option value="all">All types</option>
            {eventTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          <Button variant="ghost" size="sm" onClick={fetchLogs}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Logs Table */}
      {filteredLogs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/50 py-12 dark:border-zinc-700 dark:bg-zinc-900/50">
          <Clock className="mb-3 h-10 w-10 text-zinc-300 dark:text-zinc-600" />
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            No log entries found
          </p>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            Integration events will appear here once activity occurs.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/70">
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Status
                </th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Event
                </th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400 hidden sm:table-cell">
                  Time
                </th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400 hidden md:table-cell">
                  Details
                </th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {filteredLogs.map((log) => {
                const statusCfg =
                  STATUS_CONFIG[log.status as IntegrationLogStatus] ||
                  STATUS_CONFIG.pending;
                const StatusIcon = statusCfg.icon;
                const isExpanded = expandedIds.has(log.id);

                return (
                  <tr key={log.id} className="group">
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          statusCfg.className
                        )}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {statusCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {log.event_type}
                      </span>
                      {log.error_message && (
                        <p className="mt-0.5 text-xs text-red-500 dark:text-red-400 line-clamp-1">
                          {log.error_message}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {formatTimestamp(log.created_at)}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {isExpanded ? (
                        <pre className="max-h-40 overflow-auto rounded-lg bg-zinc-50 p-2 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                          {JSON.stringify(log.payload, null, 2)}
                        </pre>
                      ) : (
                        <span className="text-xs text-zinc-400 dark:text-zinc-500">
                          {Object.keys(log.payload || {}).length} field
                          {Object.keys(log.payload || {}).length !== 1
                            ? "s"
                            : ""}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleExpand(log.id)}
                        className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
