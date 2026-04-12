import { requireAdmin } from "@/lib/admin/actions";
import { queryLogs, getLogsSummary } from "@/lib/admin/logs-actions";
import { PageHeader } from "@/components/ui/page-header";
import { LogsViewer } from "@/components/admin/logs-viewer";

export default async function AdminLogsPage() {
  await requireAdmin();

  // Initial window: last 24h
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const [initialPage, summary] = await Promise.all([
    queryLogs({ since, source: "all", limit: 100 }),
    getLogsSummary(since, "all"),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="System Logs"
        description="Observability for all services. Filter by service, level, tag, or time range."
        backHref="/admin"
        backLabel="Back to Admin"
      />
      <LogsViewer
        initialPage={initialPage}
        initialSummary={summary}
        initialSince={since}
      />
    </div>
  );
}
