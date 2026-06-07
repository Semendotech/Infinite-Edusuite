/**
 * Analytics Route
 * 
 * Displays analytics interface
 * Requires AUDIT_VIEW permission
 */

import { createFileRoute } from '@tanstack/react-router';
import { requireAnyPermission } from '@/core/auth/route-guards';
import { REPORT_MODULE_PERMISSIONS } from '@/config/access.config';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, Calendar, Filter, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const Route = createFileRoute('/_authenticated/analytics')({
  beforeLoad: ({ context }) => {
    requireAnyPermission(context.auth, REPORT_MODULE_PERMISSIONS);
  },
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const analyticsQuery = useQuery({
    queryKey: ['analytics-metrics'],
    queryFn: async () => {
      const [paymentsResult, studentsResult, attendanceResult] = await Promise.all([
        supabase.from('payments').select('amount, status, payment_date').is('deleted_at', null),
        supabase.from('students').select('enrollment_date').is('deleted_at', null),
        supabase.from('audit_logs').select('id, action, entity_type').or('entity_type.ilike.%attendance%,action.ilike.%attendance%'),
      ]);

      if (paymentsResult.error) throw paymentsResult.error;
      if (studentsResult.error) throw studentsResult.error;
      if (attendanceResult.error) throw attendanceResult.error;

      const payments = paymentsResult.data ?? [];
      const students = studentsResult.data ?? [];
      const attendanceLogs = attendanceResult.data ?? [];

      const totalRevenue = payments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
      const completedPayments = payments.filter((payment) => /completed|paid/i.test(payment.status || '')).length;
      const paymentRate = payments.length > 0 ? Math.round((completedPayments / payments.length) * 1000) / 10 : 0;

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentEnrollments = students.filter((student) => {
        const createdAt = student.enrollment_date ? new Date(student.enrollment_date) : null;
        return createdAt ? createdAt >= thirtyDaysAgo : false;
      }).length;

      return {
        totalRevenue,
        recentEnrollments,
        paymentRate,
        attendanceEvents: attendanceLogs.length,
      };
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">System performance and insights</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Calendar className="mr-2 h-4 w-4" />
            Last 30 Days
          </Button>
          <Button variant="outline">
            <Filter className="mr-2 h-4 w-4" />
            Filters
          </Button>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">KES {analyticsQuery.data?.totalRevenue.toLocaleString() ?? 0}</div>
            <p className="text-xs text-muted-foreground">Live revenue from payments</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Enrollment</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsQuery.data?.recentEnrollments ?? 0}</div>
            <p className="text-xs text-muted-foreground">New enrollments in the last 30 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Payment Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsQuery.data?.paymentRate != null ? analyticsQuery.data.paymentRate.toFixed(1) : '0.0'}%</div>
            <p className="text-xs text-muted-foreground">Percent of completed payments</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Attendance</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsQuery.data?.attendanceEvents ?? 0}</div>
            <p className="text-xs text-muted-foreground">Recorded attendance events</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
            <CardDescription>Monthly revenue over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              Chart placeholder - Replace with actual chart component
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Enrollment Trend</CardTitle>
            <CardDescription>Student enrollment over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              Chart placeholder - Replace with actual chart component
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
