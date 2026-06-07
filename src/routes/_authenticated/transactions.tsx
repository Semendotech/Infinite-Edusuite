/**
 * Transactions Route
 * 
 * Displays transaction management interface
 * Requires FINANCE_VIEW permission
 */

import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { requireAnyPermission } from '@/core/auth/route-guards';
import { FINANCE_MODULE_PERMISSIONS } from '@/config/access.config';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeftRight, Plus, Search, Filter, Download, MoreHorizontal, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export const Route = createFileRoute('/_authenticated/transactions')({
  beforeLoad: ({ context }) => {
    requireAnyPermission(context.auth, FINANCE_MODULE_PERMISSIONS);
  },
  component: TransactionsPage,
});

function TransactionsPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const transactionsQuery = useQuery({
    queryKey: ['transactions'],
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

  const transactions = useMemo(
    () =>
      transactionsQuery.data?.map((payment) => ({
        id: payment.id,
        type: payment.payment_method ?? 'payment',
        account: payment.student_id ?? 'Student Account',
        amount: payment.amount ?? 0,
        date: payment.payment_date ?? '',
        status: payment.status ?? 'posted',
      })) ?? [],
    [transactionsQuery.data]
  );

  const transactionStats = useMemo(() => {
    const payments = transactionsQuery.data ?? [];
    const totalVolume = payments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = payments.filter((payment) => {
      if (!payment.payment_date) return false;
      const paymentDate = new Date(payment.payment_date);
      paymentDate.setHours(0, 0, 0, 0);
      return paymentDate.getTime() === today.getTime();
    }).length;
    const pendingCount = payments.filter((payment) => /pending|processing|queued/i.test(payment.status || '')).length;

    return {
      totalTransactions: payments.length,
      totalVolume,
      todayCount,
      pendingCount,
    };
  }, [transactionsQuery.data]);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'mobile_money':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'bank_transfer':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'card':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Transactions</h1>
          <p className="text-muted-foreground">View all financial transactions and ledger entries</p>
        </div>
        <Button onClick={() => navigate('/payments')}>
          <Plus className="mr-2 h-4 w-4" />
          Manual Entry
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
          <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
            <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{transactionStats.totalTransactions}</div>
            <p className="text-xs text-muted-foreground">Current number of payments</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
            <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">KES {transactionStats.totalVolume.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Sum of all recorded payment amounts</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today</CardTitle>
            <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{transactionStats.todayCount}</div>
            <p className="text-xs text-muted-foreground">Transactions created today</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{transactionStats.pendingCount}</div>
            <p className="text-xs text-muted-foreground">Payments pending completion</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Transaction Records</CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search transactions..."
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
          <CardDescription>
            View and manage all financial transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transactionsQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Loading...</div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transaction ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="font-mono text-xs">{transaction.id}</TableCell>
                    <TableCell>
                      <Badge className={getTypeColor(transaction.type)}>
                        {transaction.type?.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{transaction.account}</TableCell>
                    <TableCell>KES {transaction.amount.toLocaleString()}</TableCell>
                    <TableCell>{transaction.date}</TableCell>
                    <TableCell>
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                        {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
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
                          <DropdownMenuItem>View Details</DropdownMenuItem>
                          <DropdownMenuItem>View Ledger Entry</DropdownMenuItem>
                          <DropdownMenuItem>View Audit Trail</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">Void Transaction</DropdownMenuItem>
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
