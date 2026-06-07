import { createFileRoute } from '@tanstack/react-router';
import { requireAnyPermission } from '@/core/auth/route-guards';
import { FINANCE_MODULE_PERMISSIONS } from '@/config/access.config';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, Plus, Search, Filter, Download, MoreHorizontal, Smartphone, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export const Route = createFileRoute('/_authenticated/payments')({
  beforeLoad: ({ context }) => {
    requireAnyPermission(context.auth, FINANCE_MODULE_PERMISSIONS);
  },
  component: PaymentsPage,
});

function PaymentsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreatePaymentForm, setShowCreatePaymentForm] = useState(false);

  const paymentsQuery = useQuery({
    queryKey: ['payments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('id, student_id, amount, currency, payment_method, payment_date, reference_number, status')
        .is('deleted_at', null)
        .order('payment_date', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filteredPayments = useMemo(
    () =>
      paymentsQuery.data?.filter((payment) => {
        const query = searchQuery.toLowerCase();
        return (
          payment.student_id?.toLowerCase().includes(query) ||
          payment.reference_number?.toLowerCase().includes(query) ||
          payment.payment_method?.toLowerCase().includes(query)
        );
      }) ?? [],
    [paymentsQuery.data, searchQuery]
  );

  const totals = useMemo(() => {
    const summary = {
      total: 0,
      mobile_money: 0,
      bank_transfer: 0,
      card: 0,
    };

    paymentsQuery.data?.forEach((payment) => {
      summary.total += payment.amount ?? 0;
      if (payment.payment_method === 'mobile_money') summary.mobile_money += payment.amount ?? 0;
      if (payment.payment_method === 'bank_transfer') summary.bank_transfer += payment.amount ?? 0;
      if (payment.payment_method === 'card') summary.card += payment.amount ?? 0;
    });

    return summary;
  }, [paymentsQuery.data]);

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'mobile_money':
        return <Smartphone className="h-4 w-4" />;
      case 'bank_transfer':
        return <CreditCard className="h-4 w-4" />;
      case 'card':
        return <CreditCard className="h-4 w-4" />;
      default:
        return <CreditCard className="h-4 w-4" />;
    }
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'mobile_money':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'bank_transfer':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'card':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const formatMethodLabel = (method: string) => {
    switch (method) {
      case 'mobile_money':
        return 'Mobile Money';
      case 'bank_transfer':
        return 'Bank Transfer';
      case 'card':
        return 'Card';
      case 'check':
        return 'Check';
      default:
        return method?.replace(/_/g, ' ') ?? 'Unknown';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Payments</h1>
          <p className="text-muted-foreground">Track and manage student payments</p>
        </div>
        <Button onClick={() => setShowCreatePaymentForm((prev) => !prev)}>
          <Plus className="mr-2 h-4 w-4" />
          Record Payment
        </Button>
      </div>

      {showCreatePaymentForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create Payment</CardTitle>
            <CardDescription>Enter a new payment record</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Input placeholder="Student ID" />
              <Input placeholder="Amount" type="number" />
              <Input placeholder="Reference Number" />
              <Input placeholder="Payment Method" />
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setShowCreatePaymentForm(false)}>Cancel</Button>
              <Button className="ml-2">Save Payment</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Payments</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">KES {totals.total.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Live payment total from Supabase</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mobile Money</CardTitle>
            <Smartphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">KES {totals.mobile_money.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Mobile money receipts</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bank Transfer</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">KES {totals.bank_transfer.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Bank transfer receipts</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Card</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">KES {totals.card.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Card payments</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Payment Records</CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search payments..."
                  className="pl-9 w-64"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <CardDescription>View and manage all payment transactions</CardDescription>
        </CardHeader>
        <CardContent>
          {paymentsQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">{payment.student_id ?? 'Unknown'}</TableCell>
                    <TableCell>KES {payment.amount.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge className={getMethodColor(payment.payment_method)}>
                        <span className="flex items-center gap-1">
                          {getMethodIcon(payment.payment_method)}
                          {formatMethodLabel(payment.payment_method)}
                        </span>
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{payment.reference_number ?? '—'}</TableCell>
                    <TableCell>{payment.payment_date ? new Date(payment.payment_date).toLocaleDateString() : '—'}</TableCell>
                    <TableCell>
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                        {payment.status?.charAt(0).toUpperCase() + payment.status?.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>View Receipt</DropdownMenuItem>
                          <DropdownMenuItem>Send Confirmation</DropdownMenuItem>
                          <DropdownMenuItem>Refund Payment</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
