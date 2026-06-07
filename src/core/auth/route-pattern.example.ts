/**
 * Route-Level Enforcement Standard
 * 
 * Example demonstrating the new route pattern with permission metadata.
 * This is the single source of truth for route authorization.
 * 
 * All `_authenticated` routes must declare permissions metadata.
 * 
 * NOTE: This is documentation only. These routes don't exist yet.
 * Use this as a reference when creating new routes.
 */

import { Permission, Role } from '@/core/rbac/permissions';
import { withPermissionGuard, withPermission, withAnyPermission, withAllPermissions, withRole, withBranchAccess, withSuperAdmin } from '@/core/auth/withPermissionGuard';

/**
 * Example 1: Simple route with single permission
 */
// export const Route = createFileRoute('/students')(
//   withPermissionGuard({
//     permissions: [Permission.STUDENT_VIEW],
//     permissionMode: 'any',
//   })
// );

/**
 * Example 2: Route with multiple permissions (ANY mode)
 */
// export const Route = createFileRoute('/finance/fees')(
//   withPermissionGuard({
//     permissions: [Permission.FINANCE_VIEW, Permission.FEE_VIEW],
//     permissionMode: 'any',
//   })
// );

/**
 * Example 3: Route with multiple permissions (ALL mode)
 */
// export const Route = createFileRoute('/administration/roles')(
//   withPermissionGuard({
//     permissions: [Permission.ROLE_ASSIGN, Permission.USER_VIEW],
//     permissionMode: 'all',
//   })
// );

/**
 * Example 4: Route with role requirement
 */
// export const Route = createFileRoute('/administration/branches')(
//   withPermissionGuard({
//     roles: [Role.BRANCH_ADMIN, Role.SUPER_ADMIN],
//   })
// );

/**
 * Example 5: Route with branch access requirement
 */
// export const Route = createFileRoute('/reports/analytics')(
//   withPermissionGuard({
//     permissions: [Permission.AUDIT_VIEW],
//     requireBranch: true,
//   })
// );

/**
 * Example 6: Route with custom redirect
 */
// export const Route = createFileRoute('/finance/payments')(
//   withPermissionGuard({
//     permissions: [Permission.FINANCE_VIEW],
//     redirectTo: '/dashboard',
//   })
// );

/**
 * Example 7: Complex route with multiple requirements
 */
// export const Route = createFileRoute('/administration/users')(
//   withPermissionGuard({
//     permissions: [Permission.USER_VIEW],
//     roles: [Role.BRANCH_ADMIN, Role.SUPER_ADMIN],
//     requireBranch: true,
//     permissionMode: 'any',
//   })
// );

/**
 * Example 8: Using helper functions
 */
// export const Route = createFileRoute('/students/create')(
//   withPermission(Permission.STUDENT_CREATE)
// );

// export const Route = createFileRoute('/finance/invoices')(
//   withAnyPermission([Permission.FINANCE_VIEW, Permission.FEE_VIEW])
// );

// export const Route = createFileRoute('/administration/settings')(
//   withAllPermissions([Permission.ROLE_ASSIGN, Permission.USER_VIEW])
// );

// export const Route = createFileRoute('/administration/audit')(
//   withRole([Role.SUPER_ADMIN])
// );

// export const Route = createFileRoute('/reports/branch')(
//   withBranchAccess()
// );

// export const Route = createFileRoute('/system/config')(
//   withSuperAdmin()
// );

/**
 * Standard Route Pattern Template
 * 
 * Copy this template for new authenticated routes:
 */
// export const Route = createFileRoute('/your-route')(
//   withPermissionGuard({
//     permissions: [Permission.YOUR_PERMISSION],
//     permissionMode: 'any', // or 'all'
//     roles: [], // optional: [Role.ROLE_NAME]
//     requireBranch: false, // optional: true
//     redirectTo: undefined, // optional: '/custom-redirect'
//   })
// );

/**
 * Route Metadata Standard
 * 
 * All authenticated routes MUST include:
 * 
 * 1. permissions: Array of required permissions
 * 2. permissionMode: 'any' or 'all'
 * 3. roles: Array of required roles (optional)
 * 4. requireBranch: Boolean (optional)
 * 5. redirectTo: String (optional)
 * 
 * This metadata is used by:
 * - Sidebar menu filtering
 * - Route guards
 * - Server function protection
 * - Audit logging
 * 
 * The withPermissionGuard wrapper automatically:
 * - Adds beforeLoad guard
 * - Adds metadata to route config
 * - Preserves existing beforeLoad logic
 * - Handles super admin bypass
 * - Provides consistent redirect behavior
 */
