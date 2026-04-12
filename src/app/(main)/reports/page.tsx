"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspaceId } from "@/lib/workspace/hooks";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { FileText, Download, FileSpreadsheet, File } from "lucide-react";
import { generateDocxReport } from "@/lib/reports/docx";
import { generatePdfReport } from "@/lib/reports/pdf";
import { generateExcelReport } from "@/lib/reports/excel";

export default function ReportsPage() {
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const workspaceId = useWorkspaceId();
  const supabase = createClient();

  async function handleExport(format: "docx" | "pdf" | "excel") {
    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Not authenticated");
        return;
      }
      if (!workspaceId) {
        setError("No active workspace — pick one from the switcher first.");
        return;
      }

      // Fetch entries scoped to the current workspace. Requiring the filter
      // prevents accidentally exporting entries from another workspace.
      const entriesQuery = supabase
        .from("work_entries")
        .select(
          `
          *,
          entry_tags ( tags ( name, color ) ),
          attachments ( file_url, type )
        `
        )
        .eq("user_id", user.id)
        .eq("workspace_id", workspaceId)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: false });

      const { data: entries } = await entriesQuery;

      // Fetch profile
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("name")
        .eq("user_id", user.id)
        .single();

      if (!entries || entries.length === 0) {
        setError("No entries found for the selected date range");
        setLoading(false);
        return;
      }

      // Generate report based on format
      let blob: Blob;
      let filename: string;
      const reportName = `WIS_Report_${startDate}_to_${endDate}`;

      if (format === "docx") {
        blob = await generateDocxReport(entries, profile?.name || "User", startDate, endDate);
        filename = `${reportName}.docx`;
      } else if (format === "pdf") {
        blob = await generatePdfReport(entries, profile?.name || "User", startDate, endDate);
        filename = `${reportName}.pdf`;
      } else {
        blob = await generateExcelReport(entries, profile?.name || "User", startDate, endDate);
        filename = `${reportName}.xlsx`;
      }

      // Download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Reports & Export"
        description="Export beautiful reports to share with your team"
      />

      <Card>
        <CardHeader>
          <CardTitle>Report Settings</CardTitle>
          <CardDescription>Select date range and export format</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="startDate" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Start Date
              </label>
              <input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                max={endDate}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
              />
            </div>
            <div>
              <label htmlFor="endDate" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                End Date
              </label>
              <input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                max={format(new Date(), "yyyy-MM-dd")}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => setStartDate(format(startOfMonth(new Date()), "yyyy-MM-dd"))}
              variant="outline"
              size="sm"
            >
              This Month
            </Button>
            <Button
              onClick={() => {
                setStartDate(format(subDays(new Date(), 7), "yyyy-MM-dd"));
                setEndDate(format(new Date(), "yyyy-MM-dd"));
              }}
              variant="outline"
              size="sm"
            >
              Last 7 Days
            </Button>
            <Button
              onClick={() => {
                setStartDate(format(subDays(new Date(), 30), "yyyy-MM-dd"));
                setEndDate(format(new Date(), "yyyy-MM-dd"));
              }}
              variant="outline"
              size="sm"
            >
              Last 30 Days
            </Button>
          </div>

          {error && (
            <div className="rounded-lg bg-red-100 px-3 py-2 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-200">
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <Button
              onClick={() => handleExport("docx")}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <FileText className="h-4 w-4" />
              Export DOCX
            </Button>
            <Button
              onClick={() => handleExport("pdf")}
              disabled={loading}
              variant="outline"
              className="flex items-center gap-2"
            >
              <File className="h-4 w-4" />
              Export PDF
            </Button>
            <Button
              onClick={() => handleExport("excel")}
              disabled={loading}
              variant="outline"
              className="flex items-center gap-2"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Export Excel
            </Button>
          </div>

          {loading && (
            <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
              Generating report...
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Export Options</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm text-zinc-600 dark:text-zinc-400">
            <div>
              <h3 className="mb-2 font-medium text-zinc-900 dark:text-zinc-50">DOCX (Word)</h3>
              <p>Professional document format with images, perfect for sharing or printing. Includes all entry details, tags, and photo proofs.</p>
            </div>
            <div>
              <h3 className="mb-2 font-medium text-zinc-900 dark:text-zinc-50">PDF</h3>
              <p>Universal format for viewing and printing. Great for archiving or sharing with others who don't have Word.</p>
            </div>
            <div>
              <h3 className="mb-2 font-medium text-zinc-900 dark:text-zinc-50">Excel (XLSX)</h3>
              <p>Spreadsheet format ideal for data analysis. Includes summary statistics and can be opened in Google Sheets.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
