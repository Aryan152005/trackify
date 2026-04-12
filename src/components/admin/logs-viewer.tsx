"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { format } from "date-fns";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import {
  queryLogs, getLogsSummary, exportLogsCsv,
  type LogLevel, type LogSource, type LogsPage, type LogsSummary, type SystemLog,
} from "@/lib/admin/logs-actions";
import { createClient } from "@/lib/supabase/client";
import {
  chartAnim, tooltipStyle, tooltipWrapper, tooltipCursor,
} from "@/lib/charts/theme";
import { useIsMobile } from "@/lib/hooks/use-media-query";
import { Search, RefreshCw, ChevronDown, ChevronRight, AlertCircle, AlertTriangle, Info, Download, Radio } from "lucide-react";

interface Props {
  initialPage: LogsPage;
  initialSummary: LogsSummary;
  initialSince: string;
}

type Range = "1h" | "24h" | "7d" | "30d";
const RANGE_MS: Record<Range, number> = {
  "1h": 1000 * 60 * 60,
  "24h": 1000 * 60 * 60 * 24,
  "7d": 1000 * 60 * 60 * 24 * 7,
  "30d": 1000 * 60 * 60 * 24 * 30,
};

const ANY = "__any__";
const PAGE_SIZE = 100;

export function LogsViewer({ initialPage, initialSummary, initialSince }: Props) {
  const isMobile = useIsMobile();
  const [range, setRange] = useState<Range>("24h");
  const [source, setSource] = useState<LogSource | "all">("all");
  const [service, setService] = useState<string>(ANY);
  const [level, setLevel] = useState<string>(ANY);
  const [tag, setTag] = useState<string>(ANY);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<LogsPage>(initialPage);
  const [summary, setSummary] = useState<LogsSummary>(initialSummary);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [liveEnabled, setLiveEnabled] = useState(false);
  const [liveBurst, setLiveBurst] = useState(0); // counter that bumps on each new event
  const [exporting, setExporting] = useState(false);

  // Debounce search
  useEffect(() => {
    const h = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(h);
  }, [search]);

  const since = useMemo(
    () => new Date(Date.now() - RANGE_MS[range]).toISOString(),
    [range]
  );

  // Refetch when filters change
  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    const q = {
      since,
      source,
      service: service === ANY ? undefined : service,
      level: (level === ANY ? undefined : level) as LogLevel | undefined,
      tag: tag === ANY ? undefined : tag,
      search: debouncedSearch || undefined,
      limit: PAGE_SIZE,
      offset,
    };
    startTransition(() => {
      Promise.all([queryLogs(q), getLogsSummary(since, source)])
        .then(([p, s]) => {
          setPage(p);
          setSummary(s);
        })
        .catch((e) => setLoadError(e instanceof Error ? e.message : "Failed to load logs"))
        .finally(() => setLoading(false));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [since, source, service, level, tag, debouncedSearch, offset, liveBurst]);

  // Supabase Realtime subscription: reloads the page when a new system_logs row is inserted.
  useEffect(() => {
    if (!liveEnabled) return;
    const supabase = createClient();
    const channel = supabase
      .channel("system_logs_changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "system_logs" },
        () => {
          // Bump the burst counter to trigger a refetch of page+summary.
          setLiveBurst((n) => n + 1);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [liveEnabled]);

  async function handleExportCsv() {
    setExporting(true);
    setLoadError(null);
    try {
      const csv = await exportLogsCsv({
        since,
        source,
        service: service === ANY ? undefined : service,
        level: (level === ANY ? undefined : level) as LogLevel | undefined,
        tag: tag === ANY ? undefined : tag,
        search: debouncedSearch || undefined,
      });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `logs-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Export failed");
    }
    setExporting(false);
  }

  function refresh() {
    setOffset(0);
    setDebouncedSearch(search);
    setRange((r) => r); // triggers since recalc → effect refires
    // Force effect by bumping a state — easiest: reset offset
  }

  const totalPages = Math.max(1, Math.ceil(page.total / PAGE_SIZE));
  const currentPageIndex = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Total events" value={summary.total} tone="info" />
        <KpiCard title="Errors" value={summary.errors} tone="error" />
        <KpiCard title="Warnings" value={summary.warnings} tone="warn" />
        <KpiCard title="Info" value={summary.info} tone="success" />
      </div>

      {/* Chart */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Events over time</CardTitle>
              <CardDescription>Stacked by level · {range === "1h" ? "per minute" : "hourly/daily buckets"}</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant={liveEnabled ? "default" : "outline"}
                onClick={() => setLiveEnabled((v) => !v)}
                title={liveEnabled ? "Disable live tail" : "Enable live tail (realtime)"}
              >
                <Radio className={`mr-1.5 h-3.5 w-3.5 ${liveEnabled ? "animate-pulse" : ""}`} />
                {liveEnabled ? "Live" : "Start live"}
              </Button>
              <Button size="sm" variant="outline" onClick={handleExportCsv} disabled={exporting || loading}>
                <Download className={`mr-1.5 h-3.5 w-3.5 ${exporting ? "animate-pulse" : ""}`} />
                {exporting ? "Exporting…" : "CSV"}
              </Button>
              <Button size="sm" variant="outline" onClick={refresh} disabled={loading}>
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] sm:h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={summary.series} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="logErr" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="logWarn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="logInfo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-700" />
                <XAxis
                  dataKey="bucket"
                  tick={{ fontSize: isMobile ? 10 : 11, fill: "currentColor" }}
                  tickMargin={8}
                  tickFormatter={(v) => {
                    const d = new Date(v);
                    return range === "1h" || range === "24h"
                      ? format(d, "HH:mm")
                      : format(d, "MMM d");
                  }}
                  interval={isMobile ? "preserveStartEnd" : "preserveStartEnd"}
                />
                <YAxis tick={{ fontSize: isMobile ? 10 : 11, fill: "currentColor" }} width={isMobile ? 28 : 40} allowDecimals={false} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  wrapperStyle={tooltipWrapper}
                  cursor={tooltipCursor}
                  labelFormatter={(v) => format(new Date(v as string), "MMM d, HH:mm")}
                />
                {!isMobile && <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />}
                <Area type="monotone" dataKey="info" stackId="1" stroke="#6366f1" strokeWidth={2} fill="url(#logInfo)" name="Info" {...chartAnim} />
                <Area type="monotone" dataKey="warn" stackId="1" stroke="#f59e0b" strokeWidth={2} fill="url(#logWarn)" name="Warn" {...chartAnim} />
                <Area type="monotone" dataKey="error" stackId="1" stroke="#ef4444" strokeWidth={2} fill="url(#logErr)" name="Error" {...chartAnim} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <FilterBlock label="Source">
              <Select value={source} onValueChange={(v) => { setSource(v as LogSource | "all"); setOffset(0); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  <SelectItem value="system">System logs</SelectItem>
                  <SelectItem value="activity">Activity log</SelectItem>
                  <SelectItem value="integration">Integrations</SelectItem>
                </SelectContent>
              </Select>
            </FilterBlock>
            <FilterBlock label="Time range">
              <Select value={range} onValueChange={(v) => { setRange(v as Range); setOffset(0); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">Last 1 hour</SelectItem>
                  <SelectItem value="24h">Last 24 hours</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                </SelectContent>
              </Select>
            </FilterBlock>
            <FilterBlock label="Service">
              <Select value={service} onValueChange={(v) => { setService(v); setOffset(0); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>All services</SelectItem>
                  {summary.services.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </FilterBlock>
            <FilterBlock label="Level">
              <Select value={level} onValueChange={(v) => { setLevel(v); setOffset(0); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>All levels</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="warn">Warn</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="debug">Debug</SelectItem>
                </SelectContent>
              </Select>
            </FilterBlock>
            <FilterBlock label="Tag">
              <Select value={tag} onValueChange={(v) => { setTag(v); setOffset(0); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>All tags</SelectItem>
                  {summary.tags.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </FilterBlock>
            <FilterBlock label="Search">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
                  placeholder="Search message…"
                  className="w-full rounded-lg border border-zinc-300 bg-white py-2.5 pl-8 pr-3 text-base text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 sm:text-sm"
                />
              </div>
            </FilterBlock>
          </div>
        </CardContent>
      </Card>

      {loadError && <Alert type="error">{loadError}</Alert>}

      {/* Table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">
              Events {page.total > 0 && <span className="ml-2 text-sm font-normal text-zinc-500">({page.total.toLocaleString()} total)</span>}
            </CardTitle>
            {page.total > PAGE_SIZE && (
              <div className="flex items-center gap-2 text-sm">
                <Button size="sm" variant="outline" disabled={offset === 0 || loading} onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}>
                  Prev
                </Button>
                <span className="text-zinc-500">Page {currentPageIndex} of {totalPages}</span>
                <Button size="sm" variant="outline" disabled={offset + PAGE_SIZE >= page.total || loading} onClick={() => setOffset((o) => o + PAGE_SIZE)}>
                  Next
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {page.rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-400">
              {loading ? "Loading logs…" : "No events match the current filters."}
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
              {page.rows.map((log) => (
                <LogRow key={log.id} log={log} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FilterBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</label>
      {children}
    </div>
  );
}

function KpiCard({ title, value, tone }: { title: string; value: number; tone: "info" | "success" | "warn" | "error" }) {
  const toneMap = {
    info: "text-zinc-900 dark:text-zinc-50",
    success: "text-indigo-600 dark:text-indigo-400",
    warn: "text-amber-600 dark:text-amber-400",
    error: "text-red-600 dark:text-red-400",
  };
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardDescription className="text-xs uppercase tracking-wider">{title}</CardDescription>
        <CardTitle className={`text-2xl tabular-nums ${toneMap[tone]}`}>{value.toLocaleString()}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function LogRow({ log }: { log: SystemLog }) {
  const [open, setOpen] = useState(false);
  const Icon = log.level === "error" ? AlertCircle : log.level === "warn" ? AlertTriangle : Info;
  const levelBadge = {
    error: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
    warn: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    info: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300",
    debug: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  }[log.level];
  const iconTone = {
    error: "text-red-500",
    warn: "text-amber-500",
    info: "text-indigo-500",
    debug: "text-zinc-400",
  }[log.level];
  const hasMeta = Object.keys(log.metadata || {}).length > 0;

  return (
    <div className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-800/60">
      <button
        type="button"
        onClick={() => hasMeta && setOpen((o) => !o)}
        className={`flex w-full items-start gap-3 px-3 py-2.5 text-left text-sm transition ${hasMeta ? "hover:bg-zinc-50 dark:hover:bg-zinc-800/50" : ""}`}
      >
        <div className="flex shrink-0 items-center gap-1">
          {hasMeta ? (open ? <ChevronDown className="h-3.5 w-3.5 text-zinc-400" /> : <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />) : <span className="w-3.5" />}
          <Icon className={`h-4 w-4 ${iconTone}`} />
        </div>
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${levelBadge}`}>
          {log.level}
        </span>
        <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          {log.service}
        </span>
        {log.source !== "system" && (
          <span className="shrink-0 rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
            {log.source}
          </span>
        )}
        {log.tag && (
          <span className="shrink-0 text-[10px] font-mono text-zinc-400">
            {log.tag}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate text-zinc-800 dark:text-zinc-200">{log.message}</span>
        <span className="shrink-0 text-xs tabular-nums text-zinc-400">
          {format(new Date(log.created_at), "MMM d HH:mm:ss")}
        </span>
      </button>
      {open && hasMeta && (
        <pre className="overflow-x-auto border-t border-zinc-100 bg-zinc-50 px-8 py-2 text-[11px] leading-relaxed text-zinc-600 dark:border-zinc-800/60 dark:bg-zinc-900/50 dark:text-zinc-400">
          {JSON.stringify(log.metadata, null, 2)}
        </pre>
      )}
    </div>
  );
}
