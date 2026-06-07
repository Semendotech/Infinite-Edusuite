/**
 * Activity Route
 * 
 * Displays activity interface
 * Requires AUDIT_VIEW permission
 */

import { createFileRoute } from '@tanstack/react-router';
import { requireAnyPermission } from '@/core/auth/route-guards';
import { AUDIT_MODULE_PERMISSIONS } from '@/config/access.config';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Search, Filter, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export const Route = createFileRoute('/_authenticated/activity')({
  beforeLoad: ({ context }) => {
    requireAnyPermission(context.auth, AUDIT_MODULE_PERMISSIONS);
  },
  component: ActivityPage,
});

function ActivityPage() {
  const [searchQuery, setSearchQuery] = useState('');

  const activityQuery = useQuery({
    queryKey: ['activity'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('id, action, actor_id, entity_type, entity_id, ip_address, metadata, created_at')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const activities = useMemo(
    () =>
      activityQuery.data?.filter((activity) => {
        const query = searchQuery.toLowerCase();
        return (
          activity.action.toLowerCase().includes(query) ||
          (activity.actor_id ?? '').toLowerCase().includes(query) ||
          activity.entity_type.toLowerCase().includes(query) ||
          (activity.entity_id ?? '').toLowerCase().includes(query) ||
          (activity.ip_address ?? '').toLowerCase().includes(query)
        );
      }) ?? [],
    [activityQuery.data, searchQuery]
  );

  const getTypeColor = (type: string) => {
    if (type.includes('login')) return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    if (type.includes('created')) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    if (type.includes('payment')) return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
    return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Activity</h1>
          <p className="text-muted-foreground">Recent system activity</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search activity..." className="pl-9 w-64" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <Button variant="outline" size="icon"><Filter className="h-4 w-4" /></Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest actions across the system</CardDescription>
        </CardHeader>
        <CardContent>
          {activityQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activities.map((activity) => (
                  <TableRow key={activity.id}>
                    <TableCell className="font-mono text-xs">{new Date(activity.created_at).toLocaleString()}</TableCell>
                    <TableCell><Badge className={getTypeColor(activity.action)}>{activity.action.replace('_', ' ')}</Badge></TableCell>
                    <TableCell className="font-medium">{activity.actor_id ?? 'Unknown'}</TableCell>
                    <TableCell>{activity.entity_type} {activity.entity_id ?? ''}</TableCell>
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
