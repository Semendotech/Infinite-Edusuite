/**
 * Role definitions for the application
 */
export enum Role {
  SUPER_ADMIN = 'super_admin',
  BRANCH_ADMIN = 'branch_admin',
  FINANCE = 'finance',
  LECTURER = 'lecturer',
  STUDENT = 'student',
}

/**
 * Permission definitions organized by resource and action
 * Format: resource:action or resource:action:scope
 */
export enum Permission {
  // Branch Management
  BRANCH_VIEW = 'branch:view',
  BRANCH_CREATE = 'branch:create',
  BRANCH_UPDATE = 'branch:update',
  BRANCH_DELETE = 'branch:delete',
  
  // Student Management
  STUDENT_VIEW = 'student:view',
  STUDENT_VIEW_OWN = 'student:view:own',
  STUDENT_CREATE = 'student:create',
  STUDENT_UPDATE = 'student:update',
  STUDENT_DELETE = 'student:delete',
  
  // Finance
  FINANCE_VIEW = 'finance:view',
  FINANCE_CREATE = 'finance:create',
  FINANCE_MANAGE = 'finance:manage',
  FEE_VIEW = 'fee:view',
  FEE_VIEW_OWN = 'fee:view:own',
  FEE_CREATE = 'fee:create',
  FEE_UPDATE = 'fee:update',
  FEE_DELETE = 'fee:delete',
  TRANSACTION_VIEW = 'transaction:view',
  TRANSACTION_CREATE = 'transaction:create',
  TRANSACTION_UPDATE = 'transaction:update',
  TRANSACTION_DELETE = 'transaction:delete',
  
  // Academics
  COURSE_VIEW = 'course:view',
  COURSE_CREATE = 'course:create',
  COURSE_UPDATE = 'course:update',
  COURSE_DELETE = 'course:delete',
  EXAM_VIEW = 'exam:view',
  EXAM_CREATE = 'exam:create',
  EXAM_UPDATE = 'exam:update',
  EXAM_DELETE = 'exam:delete',
  EXAM_GRADE = 'exam:grade',
  ATTENDANCE_VIEW = 'attendance:view',
  ATTENDANCE_CREATE = 'attendance:create',
  ATTENDANCE_UPDATE = 'attendance:update',
  
  // User Management
  USER_VIEW = 'user:view',
  USER_VIEW_OWN = 'user:view:own',
  USER_CREATE = 'user:create',
  USER_UPDATE = 'user:update',
  USER_DELETE = 'user:delete',
  ROLE_ASSIGN = 'role:assign',
  ROLE_REVOKE = 'role:revoke',
  
  // Audit
  AUDIT_VIEW = 'audit:view',
  AUDIT_EXPORT = 'audit:export',
  
  // Reports
  REPORT_VIEW = 'report:view',
  REPORT_GENERATE = 'report:generate',
  REPORT_EXPORT = 'report:export',
  
  // Settings
  SETTINGS_VIEW = 'settings:view',
  SETTINGS_UPDATE = 'settings:update',
}

/**
 * Role-Permission Matrix
 * Defines which permissions each role has
 */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.SUPER_ADMIN]: Object.values(Permission), // All permissions
  
  [Role.BRANCH_ADMIN]: [
    // Branch management (limited to own branch)
    Permission.BRANCH_VIEW,
    
    // Student management
    Permission.STUDENT_VIEW,
    Permission.STUDENT_CREATE,
    Permission.STUDENT_UPDATE,
    
    // Finance
    Permission.FEE_VIEW,
    Permission.FEE_CREATE,
    Permission.FEE_UPDATE,
    Permission.TRANSACTION_VIEW,
    Permission.TRANSACTION_CREATE,
    Permission.TRANSACTION_UPDATE,
    
    // Academics
    Permission.COURSE_VIEW,
    Permission.COURSE_CREATE,
    Permission.COURSE_UPDATE,
    Permission.EXAM_VIEW,
    Permission.EXAM_CREATE,
    Permission.EXAM_UPDATE,
    Permission.ATTENDANCE_VIEW,
    Permission.ATTENDANCE_CREATE,
    Permission.ATTENDANCE_UPDATE,
    
    // User management (limited)
    Permission.USER_VIEW,
    Permission.USER_CREATE,
    Permission.USER_UPDATE,
    Permission.ROLE_ASSIGN,
    Permission.ROLE_REVOKE,
    
    // Reports
    Permission.REPORT_VIEW,
    Permission.REPORT_GENERATE,
    Permission.REPORT_EXPORT,
    
    // Settings
    Permission.SETTINGS_VIEW,
    Permission.SETTINGS_UPDATE,
  ],
  
  [Role.FINANCE]: [
    // Student view (for fee management)
    Permission.STUDENT_VIEW,
    
    // Finance permissions
    Permission.FEE_VIEW,
    Permission.FEE_CREATE,
    Permission.FEE_UPDATE,
    Permission.TRANSACTION_VIEW,
    Permission.TRANSACTION_CREATE,
    Permission.TRANSACTION_UPDATE,
    
    // Reports
    Permission.REPORT_VIEW,
    Permission.REPORT_GENERATE,
    Permission.REPORT_EXPORT,
  ],
  
  [Role.LECTURER]: [
    // Student view (for academic purposes)
    Permission.STUDENT_VIEW,
    
    // Academic permissions
    Permission.COURSE_VIEW,
    Permission.EXAM_VIEW,
    Permission.EXAM_CREATE,
    Permission.EXAM_UPDATE,
    Permission.EXAM_GRADE,
    Permission.ATTENDANCE_VIEW,
    Permission.ATTENDANCE_CREATE,
    Permission.ATTENDANCE_UPDATE,
    
    // Reports
    Permission.REPORT_VIEW,
  ],
  
  [Role.STUDENT]: [
    // Own data access
    Permission.STUDENT_VIEW_OWN,
    Permission.FEE_VIEW_OWN,
    Permission.USER_VIEW_OWN,
    
    // View-only academic data
    Permission.COURSE_VIEW,
    Permission.EXAM_VIEW,
    Permission.ATTENDANCE_VIEW,
    Permission.REPORT_VIEW,
  ],
};

/**
 * Permission groups for easier checking
 */
export const PERMISSION_GROUPS = {
  STUDENT_MANAGEMENT: [
    Permission.STUDENT_VIEW,
    Permission.STUDENT_CREATE,
    Permission.STUDENT_UPDATE,
    Permission.STUDENT_DELETE,
  ],
  
  FINANCE_MANAGEMENT: [
    Permission.FEE_VIEW,
    Permission.FEE_CREATE,
    Permission.FEE_UPDATE,
    Permission.FEE_DELETE,
    Permission.TRANSACTION_VIEW,
    Permission.TRANSACTION_CREATE,
    Permission.TRANSACTION_UPDATE,
    Permission.TRANSACTION_DELETE,
  ],
  
  ACADEMIC_MANAGEMENT: [
    Permission.COURSE_VIEW,
    Permission.COURSE_CREATE,
    Permission.COURSE_UPDATE,
    Permission.COURSE_DELETE,
    Permission.EXAM_VIEW,
    Permission.EXAM_CREATE,
    Permission.EXAM_UPDATE,
    Permission.EXAM_DELETE,
    Permission.EXAM_GRADE,
  ],
  
  USER_MANAGEMENT: [
    Permission.USER_VIEW,
    Permission.USER_CREATE,
    Permission.USER_UPDATE,
    Permission.USER_DELETE,
    Permission.ROLE_ASSIGN,
    Permission.ROLE_REVOKE,
  ],
  
  ADMIN: [
    Permission.BRANCH_VIEW,
    Permission.BRANCH_CREATE,
    Permission.BRANCH_UPDATE,
    Permission.BRANCH_DELETE,
    Permission.AUDIT_VIEW,
    Permission.AUDIT_EXPORT,
    Permission.SETTINGS_VIEW,
    Permission.SETTINGS_UPDATE,
  ],
} as const;

/**
 * Helper function to check if a permission is in a group
 */
export function permissionInGroup(permission: Permission, group: readonly Permission[]): boolean {
  return group.includes(permission);
}

/**
 * Get all permissions for a role
 */
export function getPermissionsForRole(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Check if role has specific permission
 */
export function roleHasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) || false;
}
