import { createFileRoute, Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { Download, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { StudentPortalShell } from '@/components/student-portal/StudentPortalShell';
import { requireStudentPortalUser } from '@/core/auth/student-portal';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type StudentRecord = {
  id: string;
  registration_number: string;
  first_name: string;
  last_name: string;
  status: string;
};

type PaymentRecord = {
  id: string;
  amount: number;
  currency: string;
  payment_method: string;
  payment_date: string | null;
  reference_number: string | null;
  status: string | null;
  invoice_number: string | null;
};

function formatMethodLabel(method: string) {
  switch (method) {
    case 'mobile_money':
      return 'Mobile Money';
    case 'bank_transfer':
      return 'Bank Transfer';
    case 'card':
      return 'Card';
    default:
      return method?.replace(/_/g, ' ') ?? 'Unknown';
  }
}

export const Route = createFileRoute('/_authenticated/portal/fees-payment-pdf')({
  beforeLoad: ({ context }) => requireStudentPortalUser(context.auth),
  component: FeesPaymentPdfPage,
});

function FeesPaymentPdfPage() {
  const { auth } = Route.useRouteContext();
  const [busy, setBusy] = useState(false);

  const portalDataQuery = useQuery({
    queryKey: ['portal-fees-payment-pdf', auth.user?.id],
    enabled: Boolean(auth.user?.id),
    queryFn: async () => {
      const userId = auth.user?.id;
      if (!userId) throw new Error('Authenticated user is required.');

      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('id, registration_number, first_name, last_name, status')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .maybeSingle();

      if (studentError) throw studentError;
      if (!student) return { student: null, payments: [] as PaymentRecord[] };

      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select('id, amount, currency, payment_method, payment_date, reference_number, status, invoice_number')
        .eq('student_id', student.id)
        .is('deleted_at', null)
        .order('payment_date', { ascending: false });

      if (paymentsError) throw paymentsError;
      return {
        student,
        payments: (payments ?? []) as PaymentRecord[],
      };
    },
  });

  const student = portalDataQuery.data?.student;
  const payments = portalDataQuery.data?.payments ?? [];

  const summary = useMemo(() => {
    const totalPaid = payments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
    const pendingCount = payments.filter((payment) => payment.status !== 'paid').length;
    const invoiceCount = payments.filter((payment) => payment.invoice_number).length;
    return { totalPaid, pendingCount, invoiceCount };
  }, [payments]);

  async function download() {
    if (!student) {
      toast.error('Student profile is required to generate the PDF.');
      return;
    }

    setBusy(true);
    try {
      const doc = await PDFDocument.create();
      const page = doc.addPage([595, 842]);
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const bold = await doc.embedFont(StandardFonts.HelveticaBold);
      const navy = rgb(0.15, 0.18, 0.35);

      page.drawRectangle({ x: 0, y: 762, width: 595, height: 80, color: navy });
      page.drawText('Infinite EduSuite', { x: 40, y: 800, size: 18, font: bold, color: rgb(1, 1, 1) });
      page.drawText('Fees Payment Statement', { x: 40, y: 782, size: 11, font, color: rgb(0.85, 0.9, 1) });
      page.drawText(`Student: ${student.first_name} ${student.last_name}`, { x: 40, y: 740, size: 11, font });
      page.drawText(`Registration: ${student.registration_number}`, { x: 40, y: 724, size: 11, font });
      page.drawText(`Issued: ${new Date().toLocaleDateString()}`, { x: 40, y: 708, size: 11, font });

      page.drawText('Summary', { x: 40, y: 678, size: 12, font: bold });
      page.drawText(`Total paid: KES ${summary.totalPaid.toLocaleString()}`, { x: 40, y: 656, size: 10, font });
      page.drawText(`Pending items: ${summary.pendingCount}`, { x: 40, y: 640, size: 10, font });
      page.drawText(`Invoice records: ${summary.invoiceCount}`, { x: 40, y: 624, size: 10, font });

      page.drawText('Recent payments', { x: 40, y: 592, size: 12, font: bold });
      const rows = payments.slice(0, 10);
      let y = 570;
      if (rows.length === 0) {
        page.drawText('No payments available yet.', { x: 40, y, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
      } else {
        rows.forEach((payment) => {
          const line = `${payment.payment_date ? new Date(payment.payment_date).toLocaleDateString() : 'N/A'} — ${formatMethodLabel(payment.payment_method)} — KES ${Number(payment.amount).toLocaleString()} — ${payment.status ?? 'Unknown'}`;
          page.drawText(line, { x: 40, y, size: 10, font });
          y -= 18;
        });
      }

      const bytes = await doc.save();
      const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fees-payment-${Date.now()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Fees payment PDF downloaded');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to generate PDF');
    } finally {
      setBusy(false);
    }
  }

  return (
    <StudentPortalShell
      title="Fees payment PDF"
      description="Download a PDF copy of your fees payment statement."
    >
      {portalDataQuery.isLoading ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !student ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <p className="text-lg font-semibold">No student profile linked</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account is authenticated, but we could not locate your student profile. Request a link to continue.
          </p>
          <div className="mt-6 flex justify-center">
            <Button asChild>
              <Link to="/portal/link-profile">Request profile link</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Generate a PDF statement for <span className="font-medium">{student.first_name} {student.last_name}</span>.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Total paid</p>
              <p className="mt-2 text-lg font-semibold">KES {summary.totalPaid.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-border bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Pending</p>
              <p className="mt-2 text-lg font-semibold">{summary.pendingCount}</p>
            </div>
            <div className="rounded-2xl border border-border bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Invoices</p>
              <p className="mt-2 text-lg font-semibold">{summary.invoiceCount}</p>
            </div>
          </div>
          <Button onClick={download} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
            Download PDF
          </Button>
        </div>
      )}
    </StudentPortalShell>
  );
}
