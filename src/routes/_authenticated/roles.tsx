/**
 * Roles Route
 * 
 * Displays role management interface
 * Requires ROLE_ASSIGN permission
 */

import { createFileRoute } from '@tanstack/react-router';
import { requireAnyPermission } from '@/core/auth/route-guards';
import { ROLE_ADMIN_PERMISSIONS } from '@/config/access.config';
import { useState, useMemo } from 'react';
import { Shield, Plus, Search, Filter, Download, MoreHorizontal, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export const Route = createFileRoute('/_authenticated/roles')({
  beforeLoad: ({ context }) => {
    requireAnyPermission(context.auth, ROLE_ADMIN_PERMISSIONS);
  },
  component: RolesPage,
});

function RolesPage() {
  const [searchQuery, setSearchQuery] = useState('');

  // System roles
  const roles = [
    {
      id: '1',
      name: 'Super Admin',
      description: 'Full system access with all permissions',
      permissions: 57,
      users: 0,
      isSystem: true,
    },
    {
      id: '2',
      name: 'Branch Admin',
      description: 'Branch-level administration and management',
      permissions: 42,
      users: 0,
      isSystem: true,
    },
    {
      id: '3',
      name: 'Finance',
      description: 'Financial operations and transaction management',
      permissions: 28,
      users: 0,
      isSystem: true,
    },
    {
      id: '4',
      name: 'Lecturer',
      description: 'Academic staff access and course management',
      permissions: 18,
      users: 0,
      isSystem: true,
    },
    {
      id: '5',
      name: 'Student',
      description: 'Student access to academic records',
      permissions: 8,
      users: 0,
      isSystem: true,
    },
  ];

  const stats = useMemo(() => {
    return {
      total: roles.length,
      system: roles.filter((r) => r.isSystem).length,
      custom: roles.filter((r) => !r.isSystem).length,
      totalPermissions: roles.reduce((sum, r) => sum + r.permissions, 0),
    };
  }, []);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Roles</h1>
          <p className="text-muted-foreground">Manage system roles and permissions</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Role
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Roles</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">System roles</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Roles</CardTitle>
            <Lock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.system}</div>
            <p className="text-xs text-muted-foreground">Core roles</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Custom Roles</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.custom}</div>
            <p className="text-xs text-muted-foreground">User-defined</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Permissions</CardTitle>
            <Lock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPermissions}</div>
            <p className="text-xs text-muted-foreground">Across all roles</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Role Definitions</CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search roles..."
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
            View and manage all system roles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">{role.name}</TableCell>
                    <TableCell className="text-muted-foreground">{role.description}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{role.permissions} permissions</Badge>
                    </TableCell>
                    <TableCell>{role.users} users</TableCell>
                    <TableCell>
                      {role.isSystem ? (
                        <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
                          System
                        </Badge>
                      ) : (
                        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                          Custom
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" disabled={role.isSystem}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>View Permissions</DropdownMenuItem>
                          <DropdownMenuItem>View Users</DropdownMenuItem>
                          {!role.isSystem && (
                            <>
                              <DropdownMenuItem>Edit Role</DropdownMenuItem>
                              <DropdownMenuItem>Duplicate Role</DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive">Delete Role</DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
        </CardContent>
      </Card>
    </div>
  );
}
