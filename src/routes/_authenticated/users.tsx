/**
 * Users Route
 * 
 * Displays user management interface
 * Requires USER_VIEW permission
 */

import { createFileRoute } from '@tanstack/react-router';
import { requireAnyPermission } from '@/core/auth/route-guards';
import { USER_ADMIN_PERMISSIONS } from '@/config/access.config';
import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createUser } from '@/app/server-functions/auth';
import { UserCog, Plus, Search, Filter, Download, MoreHorizontal, Shield, Mail, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export const Route = createFileRoute('/_authenticated/users')({
  beforeLoad: ({ context }) => {
    requireAnyPermission(context.auth, USER_ADMIN_PERMISSIONS);
  },
  component: UsersPage,
});

function UsersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [selectedRole, setSelectedRole] = useState('student');
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const roleDropdownRef = useRef<HTMLDivElement>(null);
  const branchDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(event.target as Node)) {
        setShowRoleDropdown(false);
      }
      if (branchDropdownRef.current && !branchDropdownRef.current.contains(event.target as Node)) {
        setShowBranchDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const branchesQuery = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name')
        .order('name', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const users = useMemo(
    () =>
      usersQuery.data?.filter((user) => {
        const query = searchQuery.toLowerCase();
        return (
          (user.full_name ?? '').toLowerCase().includes(query) ||
          (user.email ?? '').toLowerCase().includes(query)
        );
      }) ?? [],
    [usersQuery.data, searchQuery]
  );

  const stats = useMemo(() => {
    const allUsers = usersQuery.data ?? [];
    return {
      total: allUsers.length,
      active: allUsers.length,
      admins: 0,
      teachers: 0,
    };
  }, [usersQuery.data]);

  const handleCreateUser = async () => {
    setError('');
    setSuccess('');

    // Validation
    if (!fullName.trim()) {
      setError('Full name is required');
      return;
    }
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    if (!password) {
      setError('Password is required');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (!selectedBranchId) {
      setError('Please select a branch');
      return;
    }

    // Check if user already exists
    const existingUser = usersQuery.data?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (existingUser) {
      setError('A user with this email already exists');
      return;
    }

    setIsLoading(true);

    try {
      const result = await createUser({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        role: selectedRole as 'student' | 'lecturer' | 'finance' | 'branch_admin' | 'super_admin',
        branchId: selectedBranchId,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to create user');
      }

      setSuccess(`User ${fullName} created successfully!`);

      // Reset form
      setFullName('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setSelectedRole('student');
      setSelectedBranchId('');

      // Refresh users list
      await usersQuery.refetch();

      // Close form after 2 seconds
      setTimeout(() => {
        setShowAddUserForm(false);
        setSuccess('');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to create user');
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'super_admin': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'branch_admin': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'finance': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'lecturer': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      case 'student': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'inactive': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Users</h1>
          <p className="text-muted-foreground">Manage system users and permissions</p>
        </div>
        <Button onClick={() => setShowAddUserForm((prev) => !prev)}>
          <Plus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </div>

      {showAddUserForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create User</CardTitle>
            <CardDescription>Add a new user to the system</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-md text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="p-3 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-md text-sm">
                {success}
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                placeholder="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={isLoading}
              />
              <Input
                placeholder="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
              <Input
                placeholder="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                autoComplete="off"
              />
              <Input
                placeholder="Confirm Password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
                autoComplete="off"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Role</label>
                <div className="relative mt-1" ref={roleDropdownRef}>
                  <Button
                    variant="outline"
                    className="w-full justify-between bg-blue-500 text-white hover:bg-blue-600"
                    onClick={() => setShowRoleDropdown(!showRoleDropdown)}
                    disabled={isLoading}
                  >
                    {selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1).replace('_', ' ')}
                    <span>▼</span>
                  </Button>
                  {showRoleDropdown && (
                    <div className="absolute w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-10">
                      {['student', 'lecturer', 'finance', 'branch_admin', 'super_admin'].map((role) => (
                        <div
                          key={role}
                          onClick={() => {
                            setSelectedRole(role);
                            setShowRoleDropdown(false);
                          }}
                          className="px-4 py-2 bg-blue-500 text-white hover:bg-green-500 cursor-pointer transition-colors"
                        >
                          {role.charAt(0).toUpperCase() + role.slice(1).replace('_', ' ')}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Branch</label>
                <div className="relative mt-1" ref={branchDropdownRef}>
                  <Button
                    variant="outline"
                    className="w-full justify-between bg-blue-500 text-white hover:bg-blue-600"
                    onClick={() => setShowBranchDropdown(!showBranchDropdown)}
                    disabled={isLoading}
                  >
                    {branchesQuery.data?.find((b) => b.id === selectedBranchId)?.name ?? 'Select Branch'}
                    <span>▼</span>
                  </Button>
                  {showBranchDropdown && (
                    <div className="absolute w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-10 max-h-48 overflow-y-auto">
                      {branchesQuery.data && branchesQuery.data.length > 0 ? (
                        branchesQuery.data.map((branch) => (
                          <div
                            key={branch.id}
                            onClick={() => {
                              setSelectedBranchId(branch.id);
                              setShowBranchDropdown(false);
                            }}
                            className="px-4 py-2 bg-blue-500 text-white hover:bg-green-500 cursor-pointer transition-colors"
                          >
                            {branch.name}
                          </div>
                        ))
                      ) : (
                        <div className="px-4 py-2 text-gray-500">No branches available</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowAddUserForm(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateUser}
                disabled={isLoading}
                className="gap-2"
              >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Create User
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <UserCog className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">All system users</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <UserCog className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
            <p className="text-xs text-muted-foreground">Active users</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Admins</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.admins}</div>
            <p className="text-xs text-muted-foreground">Admin users</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Teachers</CardTitle>
            <UserCog className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.teachers}</div>
            <p className="text-xs text-muted-foreground">Lecturer users</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>User Records</CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
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
            View and manage all system users
          </CardDescription>
        </CardHeader>
        <CardContent>
          {usersQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : usersQuery.isError ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center text-muted-foreground">
                Failed to load users
              </div>
            </div>
          ) : users.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center text-muted-foreground">
                No users found.
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.full_name || 'N/A'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        {user.email}
                      </div>
                    </TableCell>
                    <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>View Profile</DropdownMenuItem>
                          <DropdownMenuItem>Edit User</DropdownMenuItem>
                          <DropdownMenuItem>Manage Roles</DropdownMenuItem>
                          <DropdownMenuItem>Reset Password</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">Deactivate</DropdownMenuItem>
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
