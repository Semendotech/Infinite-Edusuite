import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/portal/exam-card")({
  head: () => ({ meta: [{ title: "Exam card — Infinite EduSuite" }] }),
  component: ExamCardPage,
});

function ExamCardPage() {
  const { auth } = Route.useRouteContext();
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const doc = await PDFDocument.create();
      const page = doc.addPage([595, 420]);
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const bold = await doc.embedFont(StandardFonts.HelveticaBold);
      const navy = rgb(0.15, 0.18, 0.35);
      const emerald = rgb(0.2, 0.6, 0.5);

      page.drawRectangle({ x: 0, y: 360, width: 595, height: 60, color: navy });
      page.drawText("Infinite EduSuite", { x: 30, y: 390, size: 14, font: bold, color: rgb(1, 1, 1) });
      page.drawText("Examination Card", { x: 30, y: 374, size: 9, font, color: rgb(0.8, 0.85, 1) });

      page.drawText("Name:", { x: 30, y: 320, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
      page.drawText(auth.user?.fullName ?? "—", { x: 80, y: 320, size: 11, font: bold });
      page.drawText("Email:", { x: 30, y: 300, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
      page.drawText(auth.user?.email ?? "—", { x: 80, y: 300, size: 11, font });
      page.drawText("Issued:", { x: 30, y: 280, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
      page.drawText(new Date().toLocaleDateString(), { x: 80, y: 280, size: 11, font });

      page.drawRectangle({ x: 30, y: 30, width: 535, height: 1, color: emerald });
      page.drawText("Placeholder — connect the exams module to populate units, dates and venues.", { x: 30, y: 14, size: 8, font, color: rgb(0.5, 0.5, 0.55) });

      const bytes = await doc.save();
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `exam-card-${Date.now()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Exam card downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate PDF");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Exam card</h1>
        <p className="mt-1 text-sm text-muted-foreground">Download a PDF copy of your exam card.</p>

        <div className="mt-8 rounded-2xl border border-border bg-card p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
          <p className="text-sm">Issued to <span className="font-medium">{auth.user?.fullName}</span></p>
          <p className="text-xs text-muted-foreground">A placeholder PDF will be generated for now.</p>
          <Button className="mt-5" onClick={download} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
            Download PDF
          </Button>
        </div>
      </div>
    </div>
  );
}