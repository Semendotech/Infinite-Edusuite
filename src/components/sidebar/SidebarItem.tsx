/**
 * SidebarItem Component
 * 
 * Individual menu item component for the sidebar.
 * Handles active state highlighting, icon rendering, and nested menu support.
 */

import { Link } from '@tanstack/react-router';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { MenuItem } from '@/config/sidebar-menu.config';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface SidebarItemProps {
  item: MenuItem;
  activePath?: string;
  isActive?: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
  level?: number;
}

export function SidebarItem({
  item,
  activePath,
  isActive = false,
  isExpanded = false,
  onToggle,
  level = 0,
}: SidebarItemProps) {
  const [isChildExpanded, setIsChildExpanded] = useState(false);
  const hasChildren = item.children && item.children.length > 0;

  useEffect(() => {
    if (hasChildren && item.children?.some((child) => child.path === activePath)) {
      setIsChildExpanded(true);
    }
  }, [activePath, hasChildren, item.children]);

  const paddingLeft = level * 16 + 12; // Base padding + level offset

  return (
    <div className="w-full">
      <div className="flex items-center">
        <Link
          to={item.path}
          className={cn(
            'flex items-center flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors',
            'hover:bg-gray-100 dark:hover:bg-gray-800',
            'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500',
            isActive
              ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
              : 'text-gray-700 dark:text-gray-300'
          )}
          style={{ paddingLeft }}
        >
          {/* Icon */}
          {item.icon && (
            <item.icon className="mr-3 h-5 w-5 shrink-0" aria-hidden="true" />
          )}

          {/* Label */}
          <span className="flex-1">{item.label}</span>

          {/* Badge */}
          {item.badge && (
            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
              {item.badge}
            </span>
          )}
        </Link>

        {hasChildren && (
          <button
            type="button"
            onClick={() => setIsChildExpanded(!isChildExpanded)}
            className="flex h-10 w-10 items-center justify-center rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500"
            aria-label={isChildExpanded ? `Collapse ${item.label}` : `Expand ${item.label}`}
          >
            {isChildExpanded ? (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        )}
      </div>

      {/* Nested children */}
      {hasChildren && isChildExpanded && (
        <div className="mt-1 space-y-1">
          {item.children?.map((child) => (
            <SidebarItem
              key={child.id}
              item={child}
              activePath={activePath}
              isActive={activePath === child.path}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
