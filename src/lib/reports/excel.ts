import ExcelJS from "exceljs";

export async function generateExcelReport(
  entries: any[],
  userName: string,
  startDate: string,
  endDate: string
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Work Entries");

  // Header
  worksheet.mergeCells("A1:F1");
  worksheet.getCell("A1").value = "Work Intelligence System - Report";
  worksheet.getCell("A1").font = { size: 16, bold: true };
  worksheet.getCell("A1").alignment = { horizontal: "center" };

  worksheet.getCell("A2").value = "User:";
  worksheet.getCell("B2").value = userName;
  worksheet.getCell("A3").value = "Period:";
  worksheet.getCell("B3").value = `${startDate} to ${endDate}`;
  worksheet.getCell("A4").value = "Total Entries:";
  worksheet.getCell("B4").value = entries.length;

  // Summary stats
  const avgScore =
    entries.reduce((sum, e) => sum + (e.productivity_score || 0), 0) / entries.length;
  const doneCount = entries.filter((e) => e.status === "done").length;
  const inProgressCount = entries.filter((e) => e.status === "in-progress").length;

  worksheet.getCell("A6").value = "Summary Statistics";
  worksheet.getCell("A6").font = { bold: true };
  worksheet.getCell("A7").value = "Average Productivity Score:";
  worksheet.getCell("B7").value = avgScore.toFixed(2);
  worksheet.getCell("A8").value = "Completed:";
  worksheet.getCell("B8").value = doneCount;
  worksheet.getCell("A9").value = "In Progress:";
  worksheet.getCell("B9").value = inProgressCount;

  // Entries table
  const headerRow = worksheet.addRow([
    "Date",
    "Title",
    "Status",
    "Productivity Score",
    "Tags",
    "Description",
    "Work Done",
    "Learning",
    "Photo Count",
  ]);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF6366F1" },
  };
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };

  entries.forEach((entry) => {
    const tags = entry.entry_tags?.map((et: any) => et.tags?.name).filter(Boolean).join(", ") || "";
    worksheet.addRow([
      new Date(entry.date),
      entry.title,
      entry.status,
      entry.productivity_score || "",
      tags,
      entry.description || "",
      entry.work_done || "",
      entry.learning || "",
      entry.attachments?.length || 0,
    ]);
  });

  // Auto-size columns
  worksheet.columns.forEach((column) => {
    column.width = 20;
  });

  // Summary sheet
  const summarySheet = workbook.addWorksheet("Summary");
  summarySheet.addRow(["Metric", "Value"]);
  summarySheet.addRow(["Total Entries", entries.length]);
  summarySheet.addRow(["Average Score", avgScore.toFixed(2)]);
  summarySheet.addRow(["Completed", doneCount]);
  summarySheet.addRow(["In Progress", inProgressCount]);
  summarySheet.addRow(["Blocked", entries.filter((e) => e.status === "blocked").length]);

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
