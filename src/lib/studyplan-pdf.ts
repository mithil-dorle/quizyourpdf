import type { StudyPlan } from "./studyplan.functions";

const PRIORITY_RGB: Record<string, [number, number, number]> = {
  high: [220, 38, 38],
  medium: [217, 160, 20],
  low: [22, 148, 88],
};

export async function downloadStudyPlanPdf(opts: {
  plan: StudyPlan;
  exam: string;
  days: number;
  hoursPerDay: number;
}) {
  const { plan, exam, days, hoursPerDay } = opts;
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

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
    `${days} day${days === 1 ? "" : "s"} left  ·  ${hoursPerDay} h/day  ·  ${plan.days.length * hoursPerDay} total study hours planned`,
    40,
    62,
  );
  doc.setFontSize(9);
  doc.setTextColor(180, 180, 190);
  doc.text("Priority: red = high yield · yellow = medium · green = quick read", 40, 78);

  let y = 112;

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

  for (const day of plan.days) {
    const body: Array<[string, string, string, string]> = [];
    const meta: Array<string> = [];
    for (const slot of day.slots) {
      for (const item of slot.items) {
        body.push([slot.slot, item.topic + (item.note ? ` — ${item.note}` : ""), `${item.minutes}m`, ""]);
        meta.push(item.priority);
      }
    }
    if (!body.length) continue;

    autoTable(doc, {
      startY: y,
      head: [[`Day ${day.day}${day.focus ? ` · ${day.focus}` : ""}`, "", "", "1st  2nd  3rd"]],
      body,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 6, textColor: [30, 30, 36], lineColor: [225, 225, 232] },
      headStyles: { fillColor: [17, 17, 24], textColor: [198, 255, 62], fontStyle: "bold", fontSize: 10 },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { cellWidth: "auto" },
        2: { cellWidth: 40, halign: "center" },
        3: { cellWidth: 72 },
      },
      didParseCell: (d) => {
        if (d.section === "body" && d.column.index === 1) {
          const p = meta[d.row.index];
          const rgb = PRIORITY_RGB[p ?? "medium"] ?? PRIORITY_RGB["medium"]!;
          d.cell.styles.textColor = rgb;
          if (p === "high") d.cell.styles.fontStyle = "bold";
        }
      },
      didDrawCell: (d) => {
        if (d.section === "body" && d.column.index === 3) {
          const size = 10;
          const gap = 8;
          const cy = d.cell.y + d.cell.height / 2 - size / 2;
          let cx = d.cell.x + 8;
          doc.setDrawColor(120, 120, 130);
          doc.setLineWidth(0.7);
          for (let i = 0; i < 3; i++) {
            doc.rect(cx, cy, size, size);
            cx += size + gap;
          }
        }
      },
      margin: { left: 40, right: 40 },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;
    if (y > doc.internal.pageSize.getHeight() - 120) {
      doc.addPage();
      y = 48;
    }
  }

  doc.save(`${(exam || "study-plan").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-study-plan.pdf`);
}
