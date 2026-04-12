"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/actions";

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogSource = "system" | "activity" | "integration";

export interface SystemLog {
  id: string;
  source: LogSource;             // which underlying table this came from
  service: string;
  level: LogLevel;
  tag: string | null;
  message: string;
  metadata: Record<string, unknown>;
  user_id: string | null;
  workspace_id: string | null;
  created_at: string;
}

export interface LogsQuery {
  source?: LogSource | "all";
  service?: string;
  level?: LogLevel;
  tag?: string;
  search?: string;
  since?: string;     // ISO timestamp
  limit?: number;
  offset?: number;
}

export interface LogsPage {
  rows: SystemLog[];
  total: number;
}

// ---------------------------------------------------------------------------
// Per-source fetchers (each returns rows normalized to SystemLog shape)
// ---------------------------------------------------------------------------

async function fetchSystemLogs(q: LogsQuery): Promise<{ rows: SystemLog[]; count: number }> {
  const admin = createAdminClient();
  let query = admin
    .from("system_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });
  if (q.service) query = query.eq("service", q.service);
  if (q.level) query = query.eq("level", q.level);
  if (q.tag) query = query.eq("tag", q.tag);
  if (q.since) query = query.gte("created_at", q.since);
  if (q.search?.trim()) {
    const s = q.search.trim().replace(/[,%]/g, "");
    query = query.ilike("message", `%${s}%`);
  }
  // Fetch a wide slice for merging; final pagination happens after merge.
  const fetchLimit = Math.min(1000, (q.limit ?? 100) + (q.offset ?? 0));
  query = query.range(0, fetchLimit - 1);
  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []).map((r) => ({
    ...(r as SystemLog),
    source: "system" as LogSource,
  }));
  return { rows, count: count ?? 0 };
}

async function fetchActivityLogs(q: LogsQuery): Promise<{ rows: SystemLog[]; count: number }> {
  const admin = createAdminClient();
  // activity_log has: action, entity_type, entity_id, entity_title, metadata, workspace_id, user_id, created_at
  let query = admin
    .from("activity_log")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });
  if (q.since) query = query.gte("created_at", q.since);
  if (q.search?.trim()) {
    const s = q.search.trim().replace(/[,%]/g, "");
    query = query.ilike("entity_title", `%${s}%`);
  }
  const fetchLimit = Math.min(1000, (q.limit ?? 100) + (q.offset ?? 0));
  query = query.range(0, fetchLimit - 1);
  const { data, count, error } = await query;
  if (error) return { rows: [], count: 0 }; // table may not exist; fail quietly
  const rows: SystemLog[] = (data ?? []).map((r) => ({
    id: r.id as string,
    source: "activity" as LogSource,
    service: "activity",
    level: "info",
    tag: `${r.entity_type}.${r.action}`,
    message:
      r.entity_title
        ? `${r.action} ${r.entity_type}: ${r.entity_title}`
        : `${r.action} ${r.entity_type}`,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    user_id: (r.user_id as string) ?? null,
    workspace_id: (r.workspace_id as string) ?? null,
    created_at: r.created_at as string,
  }));
  // Apply tag filter client-side since activity's tag is synthetic
  const filtered = q.tag ? rows.filter((x) => x.tag === q.tag) : rows;
  const service = q.service; // if filtering by service != 'activity', drop all
  return {
    rows: service && service !== "activity" ? [] : filtered,
    count: service && service !== "activity" ? 0 : (count ?? 0),
  };
}

async function fetchIntegrationLogs(q: LogsQuery): Promise<{ rows: SystemLog[]; count: number }> {
  const admin = createAdminClient();
  let query = admin
    .from("integration_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });
  if (q.since) query = query.gte("created_at", q.since);
  if (q.search?.trim()) {
    const s = q.search.trim().replace(/[,%]/g, "");
    query = query.ilike("message", `%${s}%`);
  }
  const fetchLimit = Math.min(1000, (q.limit ?? 100) + (q.offset ?? 0));
  query = query.range(0, fetchLimit - 1);
  const { data, count, error } = await query;
  if (error) return { rows: [], count: 0 };
  const rows: SystemLog[] = (data ?? []).map((r) => {
    const status = (r.status as string) ?? "info";
    const level: LogLevel =
      status === "error" || status === "failed" ? "error"
      : status === "warn" || status === "warning" ? "warn"
      : "info";
    return {
      id: r.id as string,
      source: "integration" as LogSource,
      service: "integration",
      level,
      tag: (r.event as string) ?? null,
      message: (r.message as string) ?? (r.event as string) ?? "integration event",
      metadata: (r.payload as Record<string, unknown>) ?? {},
      user_id: null,
      workspace_id: null,
      created_at: r.created_at as string,
    };
  });
  const filtered = q.level ? rows.filter((x) => x.level === q.level) : rows;
  const tagFiltered = q.tag ? filtered.filter((x) => x.tag === q.tag) : filtered;
  const service = q.service;
  return {
    rows: service && service !== "integration" ? [] : tagFiltered,
    count: service && service !== "integration" ? 0 : (count ?? 0),
  };
}

export async function queryLogs(q: LogsQuery = {}): Promise<LogsPage> {
  await requireAdmin();

  const source = q.source ?? "all";
  const results = await Promise.all([
    source === "all" || source === "system" ? fetchSystemLogs(q) : Promise.resolve({ rows: [] as SystemLog[], count: 0 }),
    source === "all" || source === "activity" ? fetchActivityLogs(q) : Promise.resolve({ rows: [] as SystemLog[], count: 0 }),
    source === "all" || source === "integration" ? fetchIntegrationLogs(q) : Promise.resolve({ rows: [] as SystemLog[], count: 0 }),
  ]);

  const merged = results
    .flatMap((r) => r.rows)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const total = results.reduce((acc, r) => acc + r.count, 0);
  const limit = q.limit ?? 100;
  const offset = q.offset ?? 0;
  return { rows: merged.slice(offset, offset + limit), total };
}

/**
 * CSV export of up to 10k matching rows.
 */
export async function exportLogsCsv(q: LogsQuery = {}): Promise<string> {
  await requireAdmin();
  const page = await queryLogs({ ...q, limit: 10000, offset: 0 });
  const header = ["created_at", "source", "service", "level", "tag", "message", "user_id", "workspace_id", "metadata"];
  const esc = (v: unknown) => {
    const s = v == null ? "" : typeof v === "string" ? v : JSON.stringify(v);
    return `"${s.replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
  };
  const lines = [header.join(",")];
  for (const r of page.rows) {
    lines.push(
      [r.created_at, r.source, r.service, r.level, r.tag ?? "", r.message, r.user_id ?? "", r.workspace_id ?? "", r.metadata]
        .map(esc)
        .join(",")
    );
  }
  return lines.join("\n");
}

export interface LogsSummary {
  // Totals for the selected window (since)
  total: number;
  errors: number;
  warnings: number;
  info: number;
  // Unique services + tags seen in the window
  services: string[];
  tags: string[];
  // Time-series buckets for chart (stacked by level)
  series: { bucket: string; error: number; warn: number; info: number }[];
}

export async function getLogsSummary(since: string, source: LogSource | "all" = "all"): Promise<LogsSummary> {
  await requireAdmin();

  // Reuse the merged query for accurate cross-source totals.
  const merged = await queryLogs({ since, source, limit: 10000, offset: 0 });
  const rows = merged.rows.map((r) => ({
    level: r.level,
    service: r.service,
    tag: r.tag,
    created_at: r.created_at,
  }));
  const servicesSet = new Set<string>();
  const tagsSet = new Set<string>();
  let errors = 0, warnings = 0, info = 0;

  // Build time-series buckets (hourly if <= 24h span, daily otherwise)
  const sinceMs = Date.parse(since);
  const spanMs = Date.now() - sinceMs;
  const hourly = spanMs <= 1000 * 60 * 60 * 48; // 48h threshold
  const bucketSizeMs = hourly ? 1000 * 60 * 60 : 1000 * 60 * 60 * 24;
  const buckets = new Map<string, { error: number; warn: number; info: number }>();

  for (const r of rows) {
    const s = r.service as string;
    const t = r.tag as string | null;
    if (s) servicesSet.add(s);
    if (t) tagsSet.add(t);

    if (r.level === "error") errors++;
    else if (r.level === "warn") warnings++;
    else info++;

    const ts = Date.parse(r.created_at as string);
    const bucketStart = Math.floor(ts / bucketSizeMs) * bucketSizeMs;
    const key = new Date(bucketStart).toISOString();
    const cur = buckets.get(key) ?? { error: 0, warn: 0, info: 0 };
    if (r.level === "error") cur.error++;
    else if (r.level === "warn") cur.warn++;
    else cur.info++;
    buckets.set(key, cur);
  }

  const series = Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bucket, v]) => ({ bucket, ...v }));

  return {
    total: rows.length,
    errors,
    warnings,
    info,
    services: Array.from(servicesSet).sort(),
    tags: Array.from(tagsSet).sort(),
    series,
  };
}
