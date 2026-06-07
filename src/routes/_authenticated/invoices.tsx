import { createFileRoute } from '@tanstack/react-router';
import { requireAnyPermission } from '@/core/auth/route-guards';
import { FINANCE_MODULE_PERMISSIONS } from '@/config/access.config';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Receipt, Plus, Search, Filter, Download, MoreHorizontal, FileText, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export const Route = createFileRoute('/_authenticated/invoices')({
  beforeLoad: ({ context }) => {
    requireAnyPermission(context.auth, FINANCE_MODULE_PERMISSIONS);
  },
  component: InvoicesPage,
});

function InvoicesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateInvoiceForm, setShowCreateInvoiceForm] = useState(false);

  const invoicesQuery = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('id, invoice_number, student_id, amount, currency, payment_date, reference_number, status')
        .not('invoice_number', 'is', null)
        .is('deleted_at', null)
        .order('payment_date', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filteredInvoices = useMemo(
    () =>
      invoicesQuery.data?.filter((invoice) => {
        const query = searchQuery.toLowerCase();
        return (
          invoice.invoice_number?.toLowerCase().includes(query) ||
          invoice.student_id?.toLowerCase().includes(query) ||
          invoice.reference_number?.toLowerCase().includes(query) ||
          invoice.status?.toLowerCase().includes(query)
        );
      }) ?? [],
    [invoicesQuery.data, searchQuery]
  );

  const stats = useMemo(() => {
    const summary = {
      totalAmount: 0,
      totalCount: 0,
      paidCount: 0,
      pendingCount: 0,
      overdueCount: 0,
    };

    invoicesQuery.data?.forEach((invoice) => {
      summary.totalCount += 1;
      summary.totalAmount += invoice.amount ?? 0;
      if (invoice.status === 'paid') summary.paidCount += 1;
      if (invoice.status === 'pending') summary.pendingCount += 1;
      if (invoice.status === 'overdue') summary.overdueCount += 1;
    });

    return summary;
  }, [invoicesQuery.data]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'overdue':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Invoices</h1>
          <p className="text-muted-foreground">Generate and manage student invoices</p>
        </div>
        <Button onClick={() => setShowCreateInvoiceForm((prev) => !prev)}>
          <Plus className="mr-2 h-4 w-4" />
          Generate Invoice
        </Button>
      </div>

      {showCreateInvoiceForm && (
        <Card>
          <CardHeader>
            <CardTitle>Generate Invoice</CardTitle>
            <CardDescription>Create a new invoice for a student</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Input placeholder="Student ID" />
              <Input placeholder="Amount" type="number" />
              <Input placeholder="Invoice Number" />
              <Input placeholder="Due Date" type="date" />
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setShowCreateInvoiceForm(false)}>Cancel</Button>
              <Button className="ml-2">Create Invoice</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCount}</div>
            <p className="text-xs text-muted-foreground">Live invoices from payments table</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">KES {stats.totalAmount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">All invoice amounts</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.paidCount}</div>
            <p className="text-xs text-muted-foreground">Paid invoices</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingCount}</div>
            <p className="text-xs text-muted-foreground">Pending invoices</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Invoice Records</CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search invoices..."
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
          <CardDescription>View and manage all student invoices</CardDescription>
        </CardHeader>
        <CardContent>
          {invoicesQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-mono text-xs">{invoice.invoice_number ?? invoice.id}</TableCell>
                    <TableCell className="font-medium">{invoice.student_id ?? 'Unknown'}</TableCell>
                    <TableCell>KES {invoice.amount.toLocaleString()}</TableCell>
                    <TableCell>{invoice.payment_date ? new Date(invoice.payment_date).toLocaleDateString() : '—'}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(invoice.status)}>
                        {invoice.status?.charAt(0).toUpperCase() + invoice.status?.slice(1)}
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
                          <DropdownMenuItem>View Invoice</DropdownMenuItem>
                          <DropdownMenuItem>Download PDF</DropdownMenuItem>
                          <DropdownMenuItem>Send Email</DropdownMenuItem>
                          <DropdownMenuItem>Mark as Paid</DropdownMenuItem>
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
