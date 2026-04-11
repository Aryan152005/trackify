import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface ReportEntry {
  title?: string;
  date?: string;
  status?: string;
  productivity_score?: number;
  description?: string;
  work_done?: string;
  attachments?: { url: string }[];
  entry_tags?: { tags?: { name?: string } }[];
  [key: string]: unknown;
}

export async function generatePdfReport(
  entries: ReportEntry[],
  userName: string,
  startDate: string,
  endDate: string
): Promise<Blob> {
  const doc = new jsPDF();

  // Title
  doc.setFontSize(20);
  doc.text("Work Intelligence System - Report", 14, 20);

  // Header info
  doc.setFontSize(11);
  doc.text(`User: ${userName}`, 14, 30);
  doc.text(`Period: ${startDate} to ${endDate}`, 14, 37);
  doc.text(`Total Entries: ${entries.length}`, 14, 44);

  // Summary stats
  const avgScore =
    entries.reduce((sum, e) => sum + (e.productivity_score || 0), 0) / entries.length;
  const doneCount = entries.filter((e) => e.status === "done").length;
  const inProgressCount = entries.filter((e) => e.status === "in-progress").length;

  let yPos = 55;
  doc.setFontSize(14);
  doc.text("Summary Statistics", 14, yPos);
  yPos += 8;

  doc.setFontSize(11);
  doc.text(`Average Productivity Score: ${avgScore.toFixed(2)}`, 14, yPos);
  yPos += 7;
  doc.text(`Completed: ${doneCount}`, 14, yPos);
  yPos += 7;
  doc.text(`In Progress: ${inProgressCount}`, 14, yPos);
  yPos += 15;

  // Entries table
  const tableData = entries.map((entry) => [
    entry.date ? new Date(entry.date).toLocaleDateString() : "-",
    (entry.title ?? "").substring(0, 40) + ((entry.title ?? "").length > 40 ? "..." : ""),
    entry.status ?? "-",
    entry.productivity_score ?? "N/A",
    entry.entry_tags?.map((et) => et.tags?.name).filter(Boolean).join(", ") || "-",
  ]);

  autoTable(doc, {
    head: [["Date", "Title", "Status", "Score", "Tags"]],
    body: tableData,
    startY: yPos,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [99, 102, 241] },
  });

  // Add new page for detailed entries if needed
  const finalY = (doc as any).lastAutoTable.finalY || yPos;
  if (finalY > 250) {
    doc.addPage();
    yPos = 20;
  } else {
    yPos = finalY + 15;
  }

  // Detailed entries
  doc.setFontSize(14);
  doc.text("Detailed Entries", 14, yPos);
  yPos += 10;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (yPos > 270) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(12);
    doc.text(entry.title ?? "Untitled", 14, yPos);
    yPos += 7;

    doc.setFontSize(10);
    doc.text(
      `Date: ${entry.date ? new Date(entry.date).toLocaleDateString() : "-"} | Status: ${entry.status ?? "-"} | Score: ${entry.productivity_score ?? "N/A"}/10`,
      14,
      yPos
    );
    yPos += 6;

    if (entry.description) {
      const descLines = doc.splitTextToSize(`Description: ${entry.description}`, 180);
      doc.text(descLines, 14, yPos);
      yPos += descLines.length * 5;
    }

    if (entry.work_done) {
      const workLines = doc.splitTextToSize(`Work Done: ${entry.work_done}`, 180);
      doc.text(workLines, 14, yPos);
      yPos += workLines.length * 5;
    }

    if (entry.attachments && entry.attachments.length > 0) {
      doc.text(`Photo Proof: ${entry.attachments.length} image(s)`, 14, yPos);
      yPos += 6;
    }

    yPos += 8;
  }

  return doc.output("blob");
}
