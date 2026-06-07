import { createFileRoute, Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileText, Loader2, Search, ShieldCheck, Wallet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { StudentPortalShell } from '@/components/student-portal/StudentPortalShell';
import { requireStudentPortalUser } from '@/core/auth/student-portal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export const Route = createFileRoute('/_authenticated/portal/fees-payment')({
  beforeLoad: ({ context }) => requireStudentPortalUser(context.auth),
  component: FeesPaymentPage,
});

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

function getStatusStyle(status?: string) {
  switch (status) {
    case 'paid':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200';
    case 'pending':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200';
    case 'failed':
    case 'cancelled':
      return 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200';
    default:
      return 'bg-slate-100 text-slate-800 dark:bg-slate-950 dark:text-slate-200';
  }
}

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

function formatMethodColor(method: string) {
  switch (method) {
    case 'mobile_money':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200';
    case 'bank_transfer':
      return 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200';
    case 'card':
      return 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200';
    default:
      return 'bg-slate-100 text-slate-800 dark:bg-slate-950 dark:text-slate-200';
  }
}

function FeesPaymentPage() {
  const { auth } = Route.useRouteContext();
  const [search, setSearch] = useState('');

  const portalDataQuery = useQuery({
    queryKey: ['portal-fees-payment', auth.user?.id],
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

  const filteredPayments = useMemo(
    () =>
      payments.filter((payment) => {
        const query = search.toLowerCase();
        return (
          payment.reference_number?.toLowerCase().includes(query) ||
          payment.payment_method.toLowerCase().includes(query) ||
          payment.status?.toLowerCase().includes(query) ||
          payment.invoice_number?.toLowerCase().includes(query)
        );
      }),
    [payments, search]
  );

  const summary = useMemo(() => {
    const totalPaid = payments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
    const lastPaymentDate = payments[0]?.payment_date ?? null;
    const pendingCount = payments.filter((payment) => payment.status !== 'paid').length;
    const invoiceCount = payments.filter((payment) => payment.invoice_number).length;
    return { totalPaid, lastPaymentDate, pendingCount, invoiceCount };
  }, [payments]);

  return (
    <StudentPortalShell
      title="Fees payment"
      description="View your payment history, download fee statements, and verify your current fee status."
    >
      {portalDataQuery.isLoading ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !student ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <p className="text-lg font-semibold">No student profile linked</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account is authenticated, but we could not find an attached student record. Please request a profile link or contact the finance office.
          </p>
          <div className="mt-6 flex justify-center">
            <Button asChild>
              <Link to="/portal/link-profile">Request profile link</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Total paid</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold">KES {summary.totalPaid.toLocaleString()}</div>
                <CardDescription>All payments made to date</CardDescription>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Latest payment</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">
                  {summary.lastPaymentDate ? new Date(summary.lastPaymentDate).toLocaleDateString() : 'No payments'}
                </div>
                <CardDescription>Most recent payment received</CardDescription>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Pending items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold">{summary.pendingCount}</div>
                <CardDescription>Transactions not marked paid</CardDescription>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Invoice records</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold">{summary.invoiceCount}</div>
                <CardDescription>Linked invoices found</CardDescription>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Student</p>
                  <p className="text-xl font-semibold">
                    {student.first_name} {student.last_name} • {student.registration_number}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <Link to="/portal/fees-payment-pdf">
                      <Download className="mr-2 h-4 w-4" /> Download PDF
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/portal/fee-statement">
                      <FileText className="mr-2 h-4 w-4" /> Fee statement
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="rounded-3xl border border-border bg-card p-5">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  <span>Secure payments with your registered student account.</span>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl bg-primary/5 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Account status</p>
                    <p className="mt-2 text-lg font-semibold">{student.status}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Student ID</p>
                    <p className="mt-2 text-lg font-semibold">{student.registration_number}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Branch</p>
                    <p className="mt-2 text-lg font-semibold">{auth.branchContext?.currentBranch?.name ?? auth.user?.email}</p>
                  </div>
                </div>
              </div>

              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle>Payment history</CardTitle>
                      <CardDescription>Recent fees and payment transactions.</CardDescription>
                    </div>
                    <div className="relative max-w-sm">
                      <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search by reference, method, status"
                        className="pl-10"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {payments.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border p-10 text-center">
                      <Wallet className="mx-auto h-10 w-10 text-muted-foreground" />
                      <p className="mt-4 text-sm font-medium">No payments recorded yet.</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Your payment history will appear here once finance records are available.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Method</TableHead>
                            <TableHead>Reference</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Invoice</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredPayments.map((payment) => (
                            <TableRow key={payment.id}>
                              <TableCell>
                                {payment.payment_date ? new Date(payment.payment_date).toLocaleDateString() : 'N/A'}
                              </TableCell>
                              <TableCell className="font-medium">KES {Number(payment.amount).toLocaleString()}</TableCell>
                              <TableCell>
                                <Badge className={formatMethodColor(payment.payment_method)}>
                                  {formatMethodLabel(payment.payment_method)}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-mono text-xs">{payment.reference_number ?? '—'}</TableCell>
                              <TableCell>
                                <Badge className={getStatusStyle(payment.status ?? undefined)}>
                                  {payment.status ? payment.status.charAt(0).toUpperCase() + payment.status.slice(1) : 'Unknown'}
                                </Badge>
                              </TableCell>
                              <TableCell>{payment.invoice_number ?? '—'}</TableCell>
                              <TableCell className="text-right">
                                <Link to="/portal/fees-payment-pdf" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                                  Download
                                </Link>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Fee statement</CardTitle>
                  <CardDescription>Download your latest statement and share with finance.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    This statement is generated from your verified student profile and payment history.
                  </p>
                  <Button asChild className="w-full">
                    <Link to="/portal/fee-statement">
                      <FileText className="mr-2 h-4 w-4" /> Download statement
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full">
                    <Link to="/portal/fees-payment-pdf">
                      <Download className="mr-2 h-4 w-4" /> Download payment PDF
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Support</CardTitle>
                  <CardDescription>Need help with fees or payment posting?</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <p>Contact the finance office to resolve pending transactions or update your payment records.</p>
                    <p className="font-medium text-foreground">support@infinite-edusuite.com</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </StudentPortalShell>
  );
}
