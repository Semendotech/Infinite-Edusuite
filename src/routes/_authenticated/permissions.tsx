/**
 * Permissions Route
 * 
 * Displays permission management interface
 * Requires ROLE_ASSIGN permission
 */

import { createFileRoute } from '@tanstack/react-router';
import { requireAnyPermission } from '@/core/auth/route-guards';
import { ROLE_ADMIN_PERMISSIONS } from '@/config/access.config';
import { useState, useMemo } from 'react';
import { Lock, Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export const Route = createFileRoute('/_authenticated/permissions')({
  beforeLoad: ({ context }) => {
    requireAnyPermission(context.auth, ROLE_ADMIN_PERMISSIONS);
  },
  component: PermissionsPage,
});

function PermissionsPage() {
  const [searchQuery, setSearchQuery] = useState('');

  // System permissions
  const permissions = [
    // Branch Management
    { id: 'branch_view', name: 'branch:view', description: 'View branch information', category: 'Branch Management' },
    { id: 'branch_create', name: 'branch:create', description: 'Create new branches', category: 'Branch Management' },
    { id: 'branch_update', name: 'branch:update', description: 'Update branch information', category: 'Branch Management' },
    { id: 'branch_delete', name: 'branch:delete', description: 'Delete branches', category: 'Branch Management' },
    
    // Student Management
    { id: 'student_view', name: 'student:view', description: 'View student records', category: 'Academic' },
    { id: 'student_view_own', name: 'student:view:own', description: 'View own student records', category: 'Academic' },
    { id: 'student_create', name: 'student:create', description: 'Create new students', category: 'Academic' },
    { id: 'student_update', name: 'student:update', description: 'Update student records', category: 'Academic' },
    { id: 'student_delete', name: 'student:delete', description: 'Delete student records', category: 'Academic' },
    
    // Finance
    { id: 'finance_view', name: 'finance:view', description: 'View financial data', category: 'Finance' },
    { id: 'finance_create', name: 'finance:create', description: 'Create financial records', category: 'Finance' },
    { id: 'finance_manage', name: 'finance:manage', description: 'Manage financial operations', category: 'Finance' },
    { id: 'fee_view', name: 'fee:view', description: 'View fees', category: 'Finance' },
    { id: 'fee_view_own', name: 'fee:view:own', description: 'View own fees', category: 'Finance' },
    { id: 'fee_create', name: 'fee:create', description: 'Create fee records', category: 'Finance' },
    { id: 'fee_update', name: 'fee:update', description: 'Update fee records', category: 'Finance' },
    { id: 'fee_delete', name: 'fee:delete', description: 'Delete fee records', category: 'Finance' },
    { id: 'transaction_view', name: 'transaction:view', description: 'View transactions', category: 'Finance' },
    { id: 'transaction_create', name: 'transaction:create', description: 'Create transactions', category: 'Finance' },
    { id: 'transaction_update', name: 'transaction:update', description: 'Update transactions', category: 'Finance' },
    { id: 'transaction_delete', name: 'transaction:delete', description: 'Delete transactions', category: 'Finance' },
    
    // Academics
    { id: 'course_view', name: 'course:view', description: 'View courses', category: 'Academic' },
    { id: 'course_create', name: 'course:create', description: 'Create courses', category: 'Academic' },
    { id: 'course_update', name: 'course:update', description: 'Update courses', category: 'Academic' },
    { id: 'course_delete', name: 'course:delete', description: 'Delete courses', category: 'Academic' },
    { id: 'exam_view', name: 'exam:view', description: 'View exams', category: 'Academic' },
    { id: 'exam_create', name: 'exam:create', description: 'Create exams', category: 'Academic' },
    { id: 'exam_update', name: 'exam:update', description: 'Update exams', category: 'Academic' },
    { id: 'exam_delete', name: 'exam:delete', description: 'Delete exams', category: 'Academic' },
    { id: 'exam_grade', name: 'exam:grade', description: 'Grade exams', category: 'Academic' },
    { id: 'attendance_view', name: 'attendance:view', description: 'View attendance', category: 'Academic' },
    { id: 'attendance_create', name: 'attendance:create', description: 'Record attendance', category: 'Academic' },
    { id: 'attendance_update', name: 'attendance:update', description: 'Update attendance', category: 'Academic' },
    
    // User Management
    { id: 'user_view', name: 'user:view', description: 'View users', category: 'Administration' },
    { id: 'user_view_own', name: 'user:view:own', description: 'View own user profile', category: 'Administration' },
    { id: 'user_create', name: 'user:create', description: 'Create new users', category: 'Administration' },
    { id: 'user_update', name: 'user:update', description: 'Update user accounts', category: 'Administration' },
    { id: 'user_delete', name: 'user:delete', description: 'Delete user accounts', category: 'Administration' },
    { id: 'role_assign', name: 'role:assign', description: 'Assign roles to users', category: 'Administration' },
    { id: 'role_revoke', name: 'role:revoke', description: 'Revoke roles from users', category: 'Administration' },
    
    // Audit
    { id: 'audit_view', name: 'audit:view', description: 'View audit logs', category: 'Audit' },
    { id: 'audit_export', name: 'audit:export', description: 'Export audit logs', category: 'Audit' },
    
    // Reports
    { id: 'report_view', name: 'report:view', description: 'View reports', category: 'Reports' },
    { id: 'report_generate', name: 'report:generate', description: 'Generate reports', category: 'Reports' },
    { id: 'report_export', name: 'report:export', description: 'Export reports', category: 'Reports' },
    
    // Settings
    { id: 'settings_view', name: 'settings:view', description: 'View system settings', category: 'Administration' },
    { id: 'settings_update', name: 'settings:update', description: 'Update system settings', category: 'Administration' },
  ];

  const filteredPermissions = useMemo(
    () =>
      permissions.filter((p) => {
        const query = searchQuery.toLowerCase();
        return (
          p.name.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query) ||
          p.category.toLowerCase().includes(query)
        );
      }),
    [searchQuery]
  );

  const stats = useMemo(() => {
    const categories = [...new Set(permissions.map((p) => p.category))];
    const stats: Record<string, number> = { total: permissions.length };
    categories.forEach((cat) => {
      stats[cat] = permissions.filter((p) => p.category === cat).length;
    });
    return stats;
  }, []);

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Academic': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'Finance': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'Administration': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'Audit': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'Reports': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      case 'Branch Management': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Permissions</h1>
          <p className="text-muted-foreground">Manage system permissions</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search permissions..." className="pl-9 w-64" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <Button variant="outline" size="icon"><Filter className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Permissions</CardTitle>
            <Lock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Across all categories</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Academic</CardTitle>
            <Lock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats['Academic'] || 0}</div>
            <p className="text-xs text-muted-foreground">{((stats['Academic'] || 0) / stats.total * 100).toFixed(1)}% of total</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Finance</CardTitle>
            <Lock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats['Finance'] || 0}</div>
            <p className="text-xs text-muted-foreground">{((stats['Finance'] || 0) / stats.total * 100).toFixed(1)}% of total</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Administration</CardTitle>
            <Lock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats['Administration'] || 0}</div>
            <p className="text-xs text-muted-foreground">{((stats['Administration'] || 0) / stats.total * 100).toFixed(1)}% of total</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Permission Registry</CardTitle>
          <CardDescription>All system permissions and their descriptions</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Permission</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPermissions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                    No permissions found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredPermissions.map((permission) => (
                  <TableRow key={permission.id}>
                    <TableCell className="font-mono text-xs font-medium">{permission.name}</TableCell>
                    <TableCell>{permission.description}</TableCell>
                    <TableCell><Badge className={getCategoryColor(permission.category)}>{permission.category}</Badge></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
