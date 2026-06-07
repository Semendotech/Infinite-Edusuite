import { createFileRoute, Link } from "@tanstack/react-router";
import { GraduationCap, Building2, Users, ShieldCheck, LogOut, FileText, IdCard, DollarSign, Bell, Activity, TrendingUp, CheckCircle, AlertCircle } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { signOutUser } from "@/core/auth/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useUnifiedAuthContext, useUnifiedPermissions } from "@/core/auth/authContextManager";
import { Permission, Role } from "@/core/rbac/permissions";
import { FINANCE_MODULE_PERMISSIONS } from "@/config/access.config";
import { realtimeNotificationDelivery } from "@/core/notifications/realtime-delivery";
import { notificationService } from "@/core/notifications/notification.service";
import { Notification, NotificationType } from "@/core/notifications/notification-engine";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Infinite EduSuite" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { auth } = Route.useRouteContext();
  const qc = useQueryClient();
  const isSuperAdmin = auth.hasRole("super_admin") || auth.user?.roles?.includes(Role.SUPER_ADMIN);
  const isStudent = auth.hasRole("student") && !isSuperAdmin && !auth.hasAnyRole(["branch_admin", "finance", "lecturer"]);

  // Use unified permissions for RBAC-aware rendering
  const unifiedAuth = useUnifiedAuthContext();
  const permissions = useUnifiedPermissions();

  const branchContext = unifiedAuth?.branchContext;
  const accessibleBranchesCount = branchContext?.accessibleBranches?.length ?? 0;
  const currentBranchName = branchContext?.currentBranch?.name ?? unifiedAuth?.branchIds?.[0] ?? 'Not selected';

  // Real-time notifications state
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Setup real-time notifications
  useEffect(() => {
    if (!unifiedAuth?.userId) return;
    const branchId = unifiedAuth.branchContext?.currentBranch?.id ?? unifiedAuth.branchIds?.[0];
    if (!branchId) return;

    let active = true;
    let unsubscribe: (() => void) | null = null;

    async function loadInitialNotifications() {
      try {
        const initial = await notificationService.getUserNotifications(unifiedAuth.userId);
        if (!active) return;
        setNotifications(initial.slice(0, 10));
      } catch (error) {
        console.error('Failed to load notifications:', error);
      }
    }

    realtimeNotificationDelivery.subscribe({
      userId: unifiedAuth.userId,
      branchId,
      onNotification: (notification) => {
        setNotifications((prev) => [notification, ...prev].filter((_, index) => index < 10));
      },
      onUnreadCountChange: (count) => setUnreadCount(count),
      onError: (error) => console.error('Notification error:', error),
    }).then((unsub) => {
      if (!active) {
        unsub();
      } else {
        unsubscribe = unsub;
      }
    }).catch((error) => console.error('Notification subscription failed:', error));

    loadInitialNotifications();

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [unifiedAuth?.userId, unifiedAuth?.branchContext, unifiedAuth?.branchIds]);

  const stats = useQuery({
    queryKey: ["dashboard-stats", unifiedAuth?.branchContext?.currentBranch?.id, unifiedAuth?.branchIds],
    queryFn: async () => {
      const branchId = unifiedAuth?.branchContext?.currentBranch?.id ?? unifiedAuth?.branchIds?.[0];
      const branchFilter = (query: any) => branchId ? query.eq('branch_id', branchId) : query;

      const [students, activeUsers, pendingStudents, pendingPayments] = await Promise.all([
        branchFilter(supabase.from('students').select('*', { count: 'exact', head: true }).is('deleted_at', null)),
        branchFilter(supabase.from('profiles').select('*', { count: 'exact', head: true }).is('deleted_at', null)),
        branchFilter(supabase.from('students').select('*', { count: 'exact', head: true }).eq('status', 'pending').is('deleted_at', null)),
        branchFilter(supabase.from('payments' as any).select('*', { count: 'exact', head: true }).eq('status', 'pending').is('deleted_at', null)),
      ]);

      const { data: paymentsData, error: paymentsError } = await branchFilter(supabase.from('payments' as any).select('amount').is('deleted_at', null));
      const revenue = paymentsError ? 0 : (paymentsData || []).reduce((sum: any, payment: any) => sum + (payment?.amount || 0), 0);

      return {
        students: students.count ?? 0,
        activeUsers: activeUsers.count ?? 0,
        revenue,
        pendingTasks: (pendingStudents.count ?? 0) + ((pendingPayments as any).count ?? 0),
      };
    },
  });

  // Recent activity from audit logs
  const recentActivity = useQuery({
    queryKey: ["recent-activity", unifiedAuth?.branchContext?.currentBranch?.id, unifiedAuth?.branchIds],
    queryFn: async () => {
      const branchId = unifiedAuth?.branchContext?.currentBranch?.id ?? unifiedAuth?.branchIds?.[0];
      let query = supabase.from("audit_logs" as any).select("*");

      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data } = await query.order("created_at", { ascending: false }).limit(10);
      return data || [];
    },
  });

  async function signOut() {
    await signOutUser();
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-lg" style={{ background: "var(--gradient-primary)" }}>
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight">Infinite EduSuite</p>
              <p className="text-xs text-muted-foreground">{auth.user?.fullName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="relative">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="mr-1.5 h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        {/* Branch Context Display */}
        <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Building2 className="h-4 w-4" />
          <span>Current Branch: {currentBranchName}</span>
          {accessibleBranchesCount > 1 ? (
            <Badge variant="outline">{accessibleBranchesCount} branches</Badge>
          ) : null}
        </div>

        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome back, {auth.user?.fullName.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isSuperAdmin
              ? "Super administrator — you have full access to all branches."
              : isStudent
                ? "Student portal — access your statements, exam card and results."
                : `Roles: ${unifiedAuth?.roles?.join(", ") || auth.user?.roles?.join(", ") || "no roles assigned yet"} • ${permissions.permissions.length} permissions`}
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KPICard
            icon={Users}
            label="Total Students"
            value={stats.data?.students ?? "—"}
            hint="Current branch"
            trend="+12.5%"
          />
          {permissions.hasAnyPermission([...FINANCE_MODULE_PERMISSIONS]) && (
            <KPICard
              icon={DollarSign}
              label="Revenue"
              value={`KES ${(stats.data?.revenue || 0).toLocaleString()}`}
              hint="This month"
              trend="+20.1%"
            />
          )}
          <KPICard
            icon={ShieldCheck}
            label="Active Users"
            value={stats.data?.activeUsers ?? "—"}
            hint="Current branch"
            trend="+8.2%"
          />
          <KPICard
            icon={CheckCircle}
            label="Pending Tasks"
            value={stats.data?.pendingTasks ?? "—"}
            hint="Current branch"
            trend="-5.3%"
          />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {/* Recent Activity Feed */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Recent Activity
                </CardTitle>
                <Badge variant="outline">Live</Badge>
              </div>
              <CardDescription>Latest events across the system</CardDescription>
            </CardHeader>
            <CardContent>
              {recentActivity.isLoading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">Loading...</div>
              ) : recentActivity.data?.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Activity className="h-8 w-8 mb-2 opacity-50" />
                  <p>No recent activity</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentActivity.data?.slice(0, 5).map((activity: any) => (
                    <div key={activity.id} className="flex items-start gap-3 text-sm">
                      <div className={`mt-1 h-2 w-2 rounded-full ${
                        activity.action.includes('created') ? 'bg-green-500' :
                        activity.action.includes('deleted') ? 'bg-red-500' :
                        activity.action.includes('updated') ? 'bg-blue-500' :
                        'bg-gray-500'
                      }`} />
                      <div className="flex-1">
                        <p className="font-medium">{activity.action.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}</p>
                        <p className="text-xs text-muted-foreground">{activity.entity_type} • {new Date(activity.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notifications Panel */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notifications
                </CardTitle>
                {unreadCount > 0 && (
                  <Badge>{unreadCount}</Badge>
                )}
              </div>
              <CardDescription>Real-time updates</CardDescription>
            </CardHeader>
            <CardContent>
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Bell className="h-8 w-8 mb-2 opacity-50" />
                  <p>No notifications</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notifications.map((notification) => (
                    <div key={notification.id} className={`p-3 rounded-lg border ${
                      notification.type === NotificationType.ERROR ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950' :
                      notification.type === NotificationType.SUCCESS ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950' :
                      notification.type === NotificationType.WARNING ? 'border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950' :
                      'border-gray-200 bg-gray-50 dark:border-gray-900 dark:bg-gray-950'
                    }`}>
                      <p className="text-xs font-medium">{notification.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{notification.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{new Date(notification.createdAt).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions Based on Permissions */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {permissions.hasPermission(Permission.STUDENT_CREATE) && (
              <QuickActionCard
                icon={Users}
                title="Add Student"
                description="Register a new student"
                to="/students"
              />
            )}
            {permissions.hasAnyPermission([...FINANCE_MODULE_PERMISSIONS]) && (
              <QuickActionCard
                icon={DollarSign}
                title="Record Payment"
                description="Process a fee payment"
                to="/payments"
              />
            )}
            {permissions.hasPermission(Permission.COURSE_CREATE) && (
              <QuickActionCard
                icon={FileText}
                title="Create Course"
                description="Add a new course"
                to="/courses"
              />
            )}
            {permissions.hasPermission(Permission.USER_CREATE) && (
              <QuickActionCard
                icon={ShieldCheck}
                title="Add User"
                description="Create a new user account"
                to="/users"
              />
            )}
            {permissions.hasPermission(Permission.EXAM_CREATE) && (
              <QuickActionCard
                icon={IdCard}
                title="Schedule Exam"
                description="Create an exam schedule"
                to="/exams"
              />
            )}
            {permissions.hasPermission(Permission.REPORT_GENERATE) && (
              <QuickActionCard
                icon={TrendingUp}
                title="Generate Report"
                description="Create a new report"
                to="/reports"
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function KPICard({ icon: Icon, label, value, hint, trend }: { icon: any; label: string; value: string | number; hint: string; trend?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <div className="grid h-8 w-8 place-items-center rounded-md bg-secondary text-primary">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
        <span>{hint}</span>
        {trend && (
          <span className={trend.startsWith('+') ? 'text-green-600' : 'text-red-600'}>
            {trend}
          </span>
        )}
      </div>
    </div>
  );
}

function QuickActionCard({ icon: Icon, title, description, to }: { icon: any; title: string; description: string; to: string }) {
  return (
    <Link
      to={to as any}
      className="group rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/30"
      style={{ boxShadow: "var(--shadow-sm)" }}
    >
      <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
    </Link>
  );
}

function ActionCard({ icon: Icon, title, body, to }: { icon: typeof Building2; title: string; body: string; to: string }) {
  return (
    <Link
      to={to as "/dashboard"}
      className="group rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/30"
      style={{ boxShadow: "var(--shadow-sm)" }}
    >
      <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </Link>
  );
}
