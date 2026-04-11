import { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun, Media } from "docx";

export async function generateDocxReport(
  entries: any[],
  userName: string,
  startDate: string,
  endDate: string
): Promise<Blob> {
  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      text: "Work Intelligence System - Report",
      heading: HeadingLevel.TITLE,
      spacing: { after: 400 },
    })
  );

  // Header info
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: "User: ", bold: true }),
        new TextRun({ text: userName }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Period: ", bold: true }),
        new TextRun({ text: `${startDate} to ${endDate}` }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Total Entries: ", bold: true }),
        new TextRun({ text: entries.length.toString() }),
      ],
    }),
    new Paragraph({ text: "" })
  );

  // Summary stats
  const avgScore =
    entries.reduce((sum, e) => sum + (e.productivity_score || 0), 0) / entries.length;
  const doneCount = entries.filter((e) => e.status === "done").length;
  const inProgressCount = entries.filter((e) => e.status === "in-progress").length;

  children.push(
    new Paragraph({
      text: "Summary Statistics",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Average Productivity Score: ", bold: true }),
        new TextRun({ text: avgScore.toFixed(2) }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Completed: ", bold: true }),
        new TextRun({ text: doneCount.toString() }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "In Progress: ", bold: true }),
        new TextRun({ text: inProgressCount.toString() }),
      ],
    }),
    new Paragraph({ text: "" })
  );

  // Entries
  children.push(
    new Paragraph({
      text: "Work Entries",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    })
  );

  for (const entry of entries) {
    const entryDate = new Date(entry.date).toLocaleDateString();
    children.push(
      new Paragraph({
        text: entry.title,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 100 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: `Date: ${entryDate} | Status: ${entry.status} | Score: ${entry.productivity_score || "N/A"}/10` }),
        ],
      })
    );

    if (entry.description) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: "Description: ", bold: true })],
        }),
        new Paragraph({ text: entry.description })
      );
    }

    if (entry.work_done) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: "Work Done: ", bold: true })],
        }),
        new Paragraph({ text: entry.work_done })
      );
    }

    if (entry.learning) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: "Learning: ", bold: true })],
        }),
        new Paragraph({ text: entry.learning })
      );
    }

    // Tags
    if (entry.entry_tags && entry.entry_tags.length > 0) {
      const tagNames = entry.entry_tags.map((et: any) => et.tags?.name).filter(Boolean).join(", ");
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: "Tags: ", bold: true }),
            new TextRun({ text: tagNames }),
          ],
        })
      );
    }

    // Images (note: docx library requires base64 or buffer - simplified here)
    if (entry.attachments && entry.attachments.length > 0) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: "Photo Proof: ", bold: true })],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: `${entry.attachments.length} image(s) attached (see original entry for images)`,
              italics: true,
            }),
          ],
        })
      );
    }

    children.push(new Paragraph({ text: "" }));
  }

  const doc = new Document({
    sections: [
      {
        children,
      },
    ],
  });

  return await Packer.toBlob(doc);
}
