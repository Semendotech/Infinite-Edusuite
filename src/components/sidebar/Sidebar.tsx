/**
 * Sidebar Component
 * 
 * Main sidebar component with responsive design.
 * Integrates with RBAC system to show/hide menu items based on permissions.
 * 
 * Features:
 * - Responsive design (desktop + mobile)
 * - Collapsible state
 * - Active route highlighting using TanStack router
 * - Permission-based menu filtering
 * - Branch context awareness
 */

import { useState, useEffect } from 'react';
import { useLocation } from '@tanstack/react-router';
import { X, Menu, LogOut } from 'lucide-react';
import { signOutUser } from '@/core/auth/session';
import { PoweredBy } from '@/components/PoweredBy';
import { usePermissions } from '@/hooks/usePermissions';
import { useUnifiedAuthContext } from '@/core/auth/authContextManager';
import { getSidebarMenu } from '@/utils/sidebar-menu.utils';
import { SidebarSection } from './SidebarSection';
import { cn } from '@/lib/utils';
import { Role } from '@/core/rbac/permissions';

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();
  const { permissions, roles, isSuperAdmin, isLoading } = usePermissions();
  const unifiedAuth = useUnifiedAuthContext();

  // Get filtered menu based on user permissions
  const menu = getSidebarMenu({
    permissions,
    roles,
    isSuperAdmin,
  });

  // Debug logging
  useEffect(() => {
    console.log('[Sidebar] Debug Info:', {
      isLoading,
      permissions,
      roles,
      isSuperAdmin,
      menuLength: menu.length,
      menuSections: menu.map(s => ({ id: s.id, itemCount: s.items.length })),
    });
  }, [isLoading, permissions, roles, isSuperAdmin, menu]);

  // Get current path for active highlighting
  const currentPath = location.pathname;

  // Close mobile sidebar on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [currentPath]);

  // Handle escape key to close mobile sidebar
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileOpen) {
        setIsMobileOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isMobileOpen]);

  // Don't return null during loading - show skeleton instead
  // This ensures sidebar is always visible
  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile menu button */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className={cn(
          'lg:hidden fixed top-4 left-4 z-50 p-2 rounded-md',
          'bg-white dark:bg-gray-800 shadow-md',
          'text-gray-700 dark:text-gray-300',
          'hover:bg-gray-100 dark:hover:bg-gray-700',
          'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500'
        )}
        aria-label="Open menu"
      >
        <Menu className="h-6 w-6" aria-hidden="true" />
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50',
          'bg-white dark:bg-gray-900',
          'border-r border-gray-200 dark:border-gray-800',
          'transition-transform duration-300 ease-in-out',
          'lg:translate-x-0 lg:static lg:inset-auto',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          isCollapsed ? 'w-16' : 'w-64',
          className
        )}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-800">
          {!isCollapsed && (
            <span className="text-lg font-semibold text-gray-900 dark:text-white">
              EduSuite
            </span>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={cn(
              'p-1 rounded-md',
              'text-gray-500 dark:text-gray-400',
              'hover:bg-gray-100 dark:hover:bg-gray-800',
              'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500',
              'hidden lg:block'
            )}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <Menu className={cn('h-5 w-5', isCollapsed && 'rotate-180')} aria-hidden="true" />
          </button>
          <button
            onClick={() => setIsMobileOpen(false)}
            className={cn(
              'p-1 rounded-md',
              'text-gray-500 dark:text-gray-400',
              'hover:bg-gray-100 dark:hover:bg-gray-800',
              'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500',
              'lg:hidden'
            )}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Sidebar Content */}
        <div className="flex-1 overflow-y-auto py-4 px-3">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="h-10 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"
                />
              ))}
            </div>
          ) : menu.length === 0 ? (
            <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">
              <p className="font-medium">No accessible modules</p>
              <p className="text-xs mt-1">Contact administrator for permissions</p>
            </div>
          ) : (
            <nav className="space-y-2" aria-label="Sidebar navigation">
              {menu.map((section) => (
                <SidebarSection
                  key={section.id}
                  section={section}
                  activePath={currentPath}
                />
              ))}
            </nav>
          )}
        </div>

        {/* Sidebar Footer */}
        {!isCollapsed && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-800 space-y-3">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              <p>
                Branch:{' '}
                {isSuperAdmin
                  ? 'All Branches'
                  : unifiedAuth?.branchContext?.currentBranch?.name ?? 'Not selected'}
              </p>
              <p className="mt-1">Role: {roles.length > 0 ? roles.join(', ') : 'None'}</p>
              <p className="mt-1">Permissions: {permissions.length}</p>
            </div>
            <button
              type="button"
              onClick={() => signOutUser()}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm',
                'text-gray-700 dark:text-gray-300',
                'hover:bg-gray-100 dark:hover:bg-gray-800',
                'focus:outline-none focus:ring-2 focus:ring-blue-500',
              )}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign out
            </button>
            <PoweredBy className="pt-1 text-center text-gray-500 dark:text-gray-400" />
          </div>
        )}
        {isCollapsed && (
          <div className="border-t border-gray-200 p-2 dark:border-gray-800">
            <PoweredBy className="text-center text-[10px] leading-tight text-gray-500 dark:text-gray-400" />
          </div>
        )}
      </aside>
    </>
  );
}

/**
 * Sidebar container component for layout integration
 */
export function SidebarContainer({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar />
      <main
        className={cn(
          'flex-1 min-w-0',
          'transition-all duration-300 ease-in-out',
          isCollapsed ? 'lg:ml-16' : 'lg:ml-64'
        )}
      >
        {children}
      </main>
    </div>
  );
}
