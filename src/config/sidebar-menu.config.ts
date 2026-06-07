/**
 * Sidebar Menu Configuration
 * 
 * Defines the complete menu structure for the application.
 * Each menu item specifies required permissions for visibility.
 * 
 * This configuration is filtered by the getSidebarMenu function
 * based on the user's actual permissions.
 */

import { Permission } from '@/core/rbac/permissions';
import {
  AUDIT_MODULE_PERMISSIONS,
  BRANCH_MANAGE_PERMISSIONS,
  FINANCE_MODULE_PERMISSIONS,
  REPORT_MODULE_PERMISSIONS,
  ROLE_ADMIN_PERMISSIONS,
  STUDENT_LIST_PERMISSIONS,
  USER_ADMIN_PERMISSIONS,
} from '@/config/access.config';
import { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  FileText,
  DollarSign,
  CreditCard,
  Receipt,
  ArrowLeftRight,
  Building2,
  UserCog,
  Shield,
  Lock,
  BarChart3,
  TrendingUp,
  FileCheck,
  Activity,
  User,
  Settings,
} from 'lucide-react';

/**
 * Menu item configuration
 */
export interface MenuItem {
  id: string;
  label: string;
  path: string;
  icon?: LucideIcon;
  requiredPermissions?: Permission[];
  requiredRoles?: string[];
  children?: MenuItem[];
  badge?: string | number;
  separator?: boolean;
}

/**
 * Menu section configuration
 */
export interface MenuSection {
  id: string;
  label: string;
  items: MenuItem[];
  requiredPermissions?: Permission[];
  requiredRoles?: string[];
}

/**
 * Full menu configuration
 * This defines all possible menu items and their permission requirements
 */
export const sidebarMenuConfig: MenuSection[] = [
  {
    id: 'main',
    label: 'Main',
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        path: '/dashboard',
        icon: LayoutDashboard,
        // Dashboard is always visible for authenticated users
      },
    ],
  },
  {
    id: 'academics',
    label: 'Academics',
    items: [
      {
        id: 'students',
        label: 'Students',
        path: '/students',
        icon: Users,
        requiredPermissions: [...STUDENT_LIST_PERMISSIONS],
      },
      {
        id: 'courses',
        label: 'Courses',
        path: '/courses',
        icon: BookOpen,
        requiredPermissions: [Permission.COURSE_VIEW],
      },
      {
        id: 'exams',
        label: 'Exams',
        path: '/exams',
        icon: FileText,
        requiredPermissions: [Permission.EXAM_VIEW],
      },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    requiredPermissions: [...FINANCE_MODULE_PERMISSIONS],
    items: [
      {
        id: 'fees',
        label: 'Fees',
        path: '/fees',
        icon: DollarSign,
        requiredPermissions: [...FINANCE_MODULE_PERMISSIONS],
      },
      {
        id: 'payments',
        label: 'Payments',
        path: '/payments',
        icon: CreditCard,
        requiredPermissions: [...FINANCE_MODULE_PERMISSIONS],
      },
      {
        id: 'invoices',
        label: 'Invoices',
        path: '/invoices',
        icon: Receipt,
        requiredPermissions: [...FINANCE_MODULE_PERMISSIONS],
      },
      {
        id: 'transactions',
        label: 'Transactions',
        path: '/transactions',
        icon: ArrowLeftRight,
        requiredPermissions: [...FINANCE_MODULE_PERMISSIONS],
      },
    ],
  },
  {
    id: 'administration',
    label: 'Administration',
    requiredPermissions: [...USER_ADMIN_PERMISSIONS, ...ROLE_ADMIN_PERMISSIONS, ...BRANCH_MANAGE_PERMISSIONS],
    items: [
      {
        id: 'branches',
        label: 'Branches',
        path: '/branches',
        icon: Building2,
        requiredPermissions: [...BRANCH_MANAGE_PERMISSIONS],
      },
      {
        id: 'users',
        label: 'Users',
        path: '/users',
        icon: UserCog,
        requiredPermissions: [...USER_ADMIN_PERMISSIONS],
      },
      {
        id: 'roles',
        label: 'Roles',
        path: '/roles',
        icon: Shield,
        requiredPermissions: [...ROLE_ADMIN_PERMISSIONS],
      },
      {
        id: 'permissions',
        label: 'Permissions',
        path: '/permissions',
        icon: Lock,
        requiredPermissions: [...ROLE_ADMIN_PERMISSIONS],
      },
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    requiredPermissions: [...REPORT_MODULE_PERMISSIONS],
    items: [
      {
        id: 'reports',
        label: 'Reports',
        path: '/reports',
        icon: BarChart3,
        requiredPermissions: [...REPORT_MODULE_PERMISSIONS],
      },
      {
        id: 'analytics',
        label: 'Analytics',
        path: '/analytics',
        icon: TrendingUp,
        requiredPermissions: [...REPORT_MODULE_PERMISSIONS],
      },
    ],
  },
  {
    id: 'audit',
    label: 'Audit',
    requiredPermissions: [...AUDIT_MODULE_PERMISSIONS],
    items: [
      {
        id: 'audit-logs',
        label: 'Audit Logs',
        path: '/audit-logs',
        icon: FileCheck,
        requiredPermissions: [...AUDIT_MODULE_PERMISSIONS],
      },
      {
        id: 'activity',
        label: 'Activity',
        path: '/activity',
        icon: Activity,
        requiredPermissions: [...AUDIT_MODULE_PERMISSIONS],
      },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    items: [
      {
        id: 'profile',
        label: 'Profile',
        path: '/profile',
        icon: User,
        // Profile is always visible for authenticated users
      },
      {
        id: 'settings',
        label: 'Settings',
        path: '/settings',
        icon: Settings,
        // Settings is always visible for authenticated users
      },
    ],
  },
];

/**
 * Get menu configuration for a specific section
 */
export function getMenuSection(sectionId: string): MenuSection | undefined {
  return sidebarMenuConfig.find(section => section.id === sectionId);
}

/**
 * Get all menu items (flattened)
 */
export function getAllMenuItems(): MenuItem[] {
  const items: MenuItem[] = [];

  for (const section of sidebarMenuConfig) {
    for (const item of section.items) {
      items.push(item);
      if (item.children) {
        items.push(...item.children);
      }
    }
  }

  return items;
}
