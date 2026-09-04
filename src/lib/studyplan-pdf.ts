import type { StudyPlan } from "./studyplan.functions";

const PRIORITY_RGB: Record<string, [number, number, number]> = {
  high: [220, 38, 38],
  medium: [217, 160, 20],
  low: [22, 148, 88],
};

export async function downloadStudyPlanPdf(opts: {
  plan: StudyPlan;
  exam: string;
  weeks: number;
  hoursPerDay: number;
  studyDaysPerWeek: number;
}) {
  const { plan, exam, weeks, hoursPerDay, studyDaysPerWeek } = opts;
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const totalHours = plan.weeks.length * studyDaysPerWeek * hoursPerDay;

  doc.setFillColor(17, 17, 24);
  doc.rect(0, 0, pageW, 92, "F");
  doc.setTextColor(198, 255, 62);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(exam || "Study Plan", 40, 42);
  doc.setTextColor(235, 235, 240);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `${weeks} week${weeks === 1 ? "" : "s"} left (${weeks * 7} days)  ·  ${studyDaysPerWeek} days/week · ${hoursPerDay} h/day  ·  ${totalHours} total study hours`,
    40,
    62,
  );
  doc.setFontSize(9);
  doc.setTextColor(180, 180, 190);
  doc.text("Priority: red = high yield · yellow = medium · green = quick read", 40, 78);

  let y = 112;

  const ensureSpace = (needed: number) => {
    if (y > doc.internal.pageSize.getHeight() - needed) {
      doc.addPage();
      y = 48;
    }
  };

  if (plan.strategy.length) {
    doc.setTextColor(20, 20, 25);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Game plan", 40, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    for (const tip of plan.strategy.slice(0, 6)) {
      const lines = doc.splitTextToSize(`• ${tip}`, pageW - 80) as string[];
      doc.text(lines, 40, y);
      y += lines.length * 13;
    }
    y += 8;
  }

  for (const week of plan.weeks) {
    ensureSpace(160);

    // Topics to cover this week
    if (week.topics.length) {
      autoTable(doc, {
        startY: y,
        head: [[`Week ${week.week}${week.theme ? ` · ${week.theme}` : ""} — topics to cover`, "Time", "1st  2nd  3rd"]],
        body: week.topics.map((t) => [t.topic + (t.note ? ` — ${t.note}` : ""), `${Math.round(t.minutes / 60)}h`, ""]),
        theme: "grid",
        styles: { fontSize: 9, cellPadding: 6, textColor: [30, 30, 36], lineColor: [225, 225, 232] },
        headStyles: { fillColor: [17, 17, 24], textColor: [198, 255, 62], fontStyle: "bold", fontSize: 10 },
        columnStyles: {
          0: { cellWidth: "auto" },
          1: { cellWidth: 44, halign: "center" },
          2: { cellWidth: 72 },
        },
        didParseCell: (d) => {
          if (d.section === "body" && d.column.index === 0) {
            const p = week.topics[d.row.index]?.priority ?? "medium";
            d.cell.styles.textColor = PRIORITY_RGB[p] ?? PRIORITY_RGB["medium"]!;
            if (p === "high") d.cell.styles.fontStyle = "bold";
          }
        },
        didDrawCell: (d) => {
          if (d.section === "body" && d.column.index === 2) drawBoxes(doc, d.cell);
        },
        margin: { left: 40, right: 40 },
      });
      y = lastY(doc) + 10;
    }

    // Weekly timetable
    const body: Array<[string, string, string, string]> = [];
    const meta: string[] = [];
    for (const day of week.days) {
      day.items.forEach((it, i) => {
        body.push([
          i === 0 ? `${day.name}${day.focus ? `\n${day.focus}` : ""}` : "",
          it.topic + (it.note ? ` — ${it.note}` : ""),
          `${it.minutes}m`,
          "",
        ]);
        meta.push(it.priority);
      });
    }

    if (body.length) {
      ensureSpace(120);
      autoTable(doc, {
        startY: y,
        head: [[`Week ${week.week} timetable`, "", "", "1st  2nd  3rd"]],
        body,
        theme: "grid",
        styles: { fontSize: 9, cellPadding: 6, textColor: [30, 30, 36], lineColor: [225, 225, 232] },
        headStyles: { fillColor: [34, 34, 44], textColor: [198, 255, 62], fontStyle: "bold", fontSize: 10 },
        columnStyles: {
          0: { cellWidth: 100, fontStyle: "bold" },
          1: { cellWidth: "auto" },
          2: { cellWidth: 40, halign: "center" },
          3: { cellWidth: 72 },
        },
        didParseCell: (d) => {
          if (d.section === "body" && d.column.index === 1) {
            const p = meta[d.row.index] ?? "medium";
            d.cell.styles.textColor = PRIORITY_RGB[p] ?? PRIORITY_RGB["medium"]!;
            if (p === "high") d.cell.styles.fontStyle = "bold";
          }
        },
        didDrawCell: (d) => {
          if (d.section === "body" && d.column.index === 3) drawBoxes(doc, d.cell);
        },
        margin: { left: 40, right: 40 },
      });
      y = lastY(doc) + 10;
    }

    if (week.milestone) {
      ensureSpace(60);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(20, 20, 25);
      const lines = doc.splitTextToSize(`Week ${week.week} milestone: ${week.milestone}`, pageW - 80) as string[];
      doc.text(lines, 40, y);
      y += lines.length * 12 + 14;
    } else {
      y += 8;
    }
  }

  doc.save(`${(exam || "study-plan").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-study-plan.pdf`);
}

function lastY(doc: unknown) {
  return (doc as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

function drawBoxes(doc: import("jspdf").jsPDF, cell: { x: number; y: number; height: number }) {
  const size = 10;
  const gap = 8;
  const cy = cell.y + cell.height / 2 - size / 2;
  let cx = cell.x + 8;
  doc.setDrawColor(120, 120, 130);
  doc.setLineWidth(0.7);
  for (let i = 0; i < 3; i++) {
    doc.rect(cx, cy, size, size);
    cx += size + gap;
  }
}
