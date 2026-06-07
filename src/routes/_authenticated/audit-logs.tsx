/**
 * Audit Logs Route
 * 
 * Displays audit logs interface
 * Requires AUDIT_VIEW permission
 */

import { createFileRoute } from '@tanstack/react-router';
import { requireAnyPermission } from '@/core/auth/route-guards';
import { AUDIT_MODULE_PERMISSIONS } from '@/config/access.config';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileCheck, Search, Filter, Download, MoreHorizontal, Clock, User, Shield, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export const Route = createFileRoute('/_authenticated/audit-logs')({
  beforeLoad: ({ context }) => {
    requireAnyPermission(context.auth, AUDIT_MODULE_PERMISSIONS);
  },
  component: AuditLogsPage,
});

function AuditLogsPage() {
  const [searchQuery, setSearchQuery] = useState('');

  const auditLogsQuery = useQuery({
    queryKey: ['audit_logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const auditLogs = useMemo(
    () =>
      auditLogsQuery.data?.filter((log) => {
        const query = searchQuery.toLowerCase();
        return (
          log.action.toLowerCase().includes(query) ||
          (log.actor_id ?? '').toLowerCase().includes(query) ||
          (log.entity_type ?? '').toLowerCase().includes(query) ||
          (log.entity_id ?? '').toLowerCase().includes(query) ||
          (log.branch_id ?? '').toLowerCase().includes(query) ||
          (log.ip_address ?? '').toLowerCase().includes(query)
        );
      }) ?? [],
    [auditLogsQuery.data, searchQuery]
  );

  const getActionColor = (action: string) => {
    if (action.includes('created') || action.includes('generated')) {
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    } else if (action.includes('deleted') || action.includes('failed')) {
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
    } else if (action.includes('updated') || action.includes('processed')) {
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    }
    return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
  };

  const stats = useMemo(() => {
    const allLogs = auditLogsQuery.data ?? [];
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const todayCount = allLogs.filter((log) => 
      new Date(log.created_at) >= todayStart
    ).length;
    
    const uniqueActors = new Set(allLogs.map((log) => log.actor_id)).size;
    
    const criticalCount = allLogs.filter((log) =>
      log.action.toLowerCase().includes('deleted') ||
      log.action.toLowerCase().includes('failed') ||
      log.action.toLowerCase().includes('unauthorized') ||
      log.action.toLowerCase().includes('error')
    ).length;
    
    return {
      total: allLogs.length,
      today: todayCount,
      activeUsers: uniqueActors,
      critical: criticalCount,
    };
  }, [auditLogsQuery.data]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Audit Logs</h1>
          <p className="text-muted-foreground">View system activity and audit trails</p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export Logs
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <FileCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">All recorded events</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.today}</div>
            <p className="text-xs text-muted-foreground">Last 24 hours</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeUsers}</div>
            <p className="text-xs text-muted-foreground">Unique actors today</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Events</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.critical}</div>
            <p className="text-xs text-muted-foreground">Requires attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Audit Trail</CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search logs..."
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
            View all system audit events
          </CardDescription>
        </CardHeader>
        <CardContent>
          {auditLogsQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : auditLogsQuery.isError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
              Unable to load audit logs: {auditLogsQuery.error?.message ?? 'Unknown error'}
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
              No audit logs found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Entity ID</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-xs">{new Date(log.created_at).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge className={getActionColor(log.action)}>
                        {log.action.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{log.actor_id ?? 'Unknown'}</TableCell>
                    <TableCell>{log.entity_type}</TableCell>
                    <TableCell className="font-mono text-xs">{log.entity_id ?? '—'}</TableCell>
                    <TableCell>{log.branch_id ?? '—'}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>View Details</DropdownMenuItem>
                          <DropdownMenuItem>View Metadata</DropdownMenuItem>
                          <DropdownMenuItem>View Actor Profile</DropdownMenuItem>
                          <DropdownMenuItem>Export Entry</DropdownMenuItem>
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
