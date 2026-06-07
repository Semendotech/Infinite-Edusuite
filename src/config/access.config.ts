import { Permission } from '@/core/rbac/permissions';

/**
 * Shared permission sets for sidebar menu and route guards.
 * Keep these in sync so navigation and access control match.
 */

/** Staff finance module (fees, payments, invoices, transactions) */
export const FINANCE_MODULE_PERMISSIONS = [
  Permission.FINANCE_VIEW,
  Permission.FEE_VIEW,
  Permission.TRANSACTION_VIEW,
] as const;

/** Student / own fee portal views */
export const FEE_OWN_PERMISSIONS = [Permission.FEE_VIEW_OWN] as const;

/** Full student registry (not own-record only) */
export const STUDENT_LIST_PERMISSIONS = [Permission.STUDENT_VIEW] as const;

/** Reports & analytics */
export const REPORT_MODULE_PERMISSIONS = [Permission.REPORT_VIEW] as const;

/** Audit logs & activity */
export const AUDIT_MODULE_PERMISSIONS = [Permission.AUDIT_VIEW] as const;

/** Branch CRUD (super admin) */
export const BRANCH_MANAGE_PERMISSIONS = [
  Permission.BRANCH_CREATE,
  Permission.BRANCH_UPDATE,
  Permission.BRANCH_DELETE,
] as const;

/** User administration */
export const USER_ADMIN_PERMISSIONS = [Permission.USER_VIEW] as const;

/** Roles & permissions administration */
export const ROLE_ADMIN_PERMISSIONS = [Permission.ROLE_ASSIGN] as const;