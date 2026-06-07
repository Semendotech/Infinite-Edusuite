/**
 * Sidebar Menu Utilities
 * 
 * Functions for filtering and processing sidebar menu configuration
 * based on user permissions and roles.
 * 
 * Uses the unified auth context manager as the single source of truth.
 */

import { Permission } from '@/core/rbac/permissions';
import { MenuSection, MenuItem } from '@/config/sidebar-menu.config';
import { sidebarMenuConfig } from '@/config/sidebar-menu.config';
import { studentSidebarMenuConfig } from '@/config/student-sidebar-menu.config';
import { authContextManager } from '@/core/auth/authContextManager';
import { isStudentPortalUser } from '@/core/auth/student-portal';

/**
 * User permissions context
 */
export interface UserPermissionsContext {
  permissions: Permission[];
  roles: string[];
  isSuperAdmin: boolean;
}

/**
 * Check if user has required permissions
 */
function hasRequiredPermissions(
  user: UserPermissionsContext,
  requiredPermissions?: Permission[]
): boolean {
  const permissions = user?.permissions || [];

  if (!requiredPermissions || requiredPermissions.length === 0) {
    return true;
  }

  if (user.isSuperAdmin) {
    return true;
  }

  return requiredPermissions.some(permission => permissions.includes(permission));
}

/**
 * Check if user has required roles
 */
function hasRequiredRoles(
  user: UserPermissionsContext,
  requiredRoles?: string[]
): boolean {
  const roles = user?.roles || [];

  if (!requiredRoles || requiredRoles.length === 0) {
    return true;
  }

  return requiredRoles.some(role => roles.includes(role));
}

/**
 * Filter menu item based on user permissions
 */
function filterMenuItem(
  item: MenuItem,
  user: UserPermissionsContext
): MenuItem | null {
  // Check permissions
  if (!hasRequiredPermissions(user, item.requiredPermissions)) {
    return null;
  }

  // Check roles
  if (!hasRequiredRoles(user, item.requiredRoles)) {
    return null;
  }

  // If item has children, filter them recursively
  if (item.children && item.children.length > 0) {
    const filteredChildren = item.children
      .map(child => filterMenuItem(child, user))
      .filter((child): child is MenuItem => child !== null);

    // If no children remain after filtering, remove the parent item
    if (filteredChildren.length === 0) {
      return null;
    }

    // Return item with filtered children
    return {
      ...item,
      children: filteredChildren,
    };
  }

  return item;
}

/**
 * Filter menu section based on user permissions
 */
function filterMenuSection(
  section: MenuSection,
  user: UserPermissionsContext
): MenuSection | null {
  // Check section-level permissions
  if (!hasRequiredPermissions(user, section.requiredPermissions)) {
    return null;
  }

  // Check section-level roles
  if (!hasRequiredRoles(user, section.requiredRoles)) {
    return null;
  }

  // Filter items in the section
  const filteredItems = section.items
    .map(item => filterMenuItem(item, user))
    .filter((item): item is MenuItem => item !== null);

  // If no items remain after filtering, remove the section
  if (filteredItems.length === 0) {
    return null;
  }

  // Return section with filtered items
  return {
    ...section,
    items: filteredItems,
  };
}

/**
 * Get sidebar menu filtered by user permissions
 * This is the main function that filters the full menu configuration
 * based on the user's actual permissions and roles.
 * 
 * Uses the unified auth context manager as the single source of truth.
 */
export function getSidebarMenu(user?: UserPermissionsContext): MenuSection[] {
  const context = user || {
    permissions: authContextManager.getPermissions() || [],
    roles: authContextManager.getRoles() || [],
    isSuperAdmin: authContextManager.isSuperAdmin() || false,
  };

  console.log('[SidebarMenu] Context:', context);
  console.log('[SidebarMenu] Permissions count:', context.permissions.length);
  console.log('[SidebarMenu] Roles:', context.roles);
  console.log('[SidebarMenu] Is Super Admin:', context.isSuperAdmin);

  const safeContext: UserPermissionsContext = {
    permissions: context.permissions || [],
    roles: context.roles || [],
    isSuperAdmin: context.isSuperAdmin || false,
  };

  const menuSource = isStudentPortalUser(safeContext.roles)
    ? studentSidebarMenuConfig
    : sidebarMenuConfig;

  const menu = menuSource
    .map(section => filterMenuSection(section, safeContext))
    .filter((section): section is MenuSection => section !== null);

  console.log('[SidebarMenu] Filtered menu sections:', menu.length);

  if (menu.length === 0) {
    console.log('[SidebarMenu] No menu items filtered, showing fallback');
    const dashboardItem = getMenuItemById('dashboard');
    const profileItem = getMenuItemById('profile');
    const settingsItem = getMenuItemById('settings');

    return [
      {
        id: 'main',
        label: 'Main',
        items: [dashboardItem].filter((item): item is MenuItem => item !== null),
      },
      {
        id: 'settings',
        label: 'Settings',
        items: [profileItem, settingsItem].filter((item): item is MenuItem => item !== null),
      },
    ];
  }

  console.log('[SidebarMenu] Final menu items:', menu.map(s => ({ id: s.id, itemCount: s.items.length })));
  return menu;
}

/**
 * Check if a specific menu item is accessible to the user
 * Uses the unified auth context manager as the single source of truth.
 */
export function isMenuItemAccessible(
  itemId: string,
  user?: UserPermissionsContext
): boolean {
  const context = user || {
    permissions: authContextManager.getPermissions(),
    roles: authContextManager.getRoles(),
    isSuperAdmin: authContextManager.isSuperAdmin(),
  };

  const menu = getSidebarMenu(context);

  for (const section of menu) {
    for (const item of section.items) {
      if (item.id === itemId) {
        return true;
      }

      // Check nested children
      if (item.children) {
        for (const child of item.children) {
          if (child.id === itemId) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

/**
 * Get menu item by ID from the full configuration
 */
export function getMenuItemById(itemId: string): MenuItem | null {
  for (const section of sidebarMenuConfig) {
    for (const item of section.items) {
      if (item.id === itemId) {
        return item;
      }

      // Check nested children
      if (item.children) {
        for (const child of item.children) {
          if (child.id === itemId) {
            return child;
          }
        }
      }
    }
  }

  return null;
}

/**
 * Get menu section by ID
 */
export function getMenuSectionById(sectionId: string): MenuSection | null {
  return sidebarMenuConfig.find(section => section.id === sectionId) || null;
}

/**
 * Flatten menu items from all sections
 */
export function flattenMenuItems(menu: MenuSection[]): MenuItem[] {
  const items: MenuItem[] = [];

  for (const section of menu) {
    for (const item of section.items) {
      items.push(item);

      // Add nested children
      if (item.children) {
        items.push(...item.children);
      }
    }
  }

  return items;
}

/**
 * Get breadcrumb trail for a given path
 */
export function getBreadcrumbTrail(path: string, menu: MenuSection[]): MenuItem[] {
  const breadcrumb: MenuItem[] = [];

  for (const section of menu) {
    for (const item of section.items) {
      if (item.path === path) {
        breadcrumb.push(item);
        return breadcrumb;
      }

      // Check nested children
      if (item.children) {
        for (const child of item.children) {
          if (child.path === path) {
            breadcrumb.push(item); // Add parent
            breadcrumb.push(child); // Add child
            return breadcrumb;
          }
        }
      }
    }
  }

  return breadcrumb;
}
