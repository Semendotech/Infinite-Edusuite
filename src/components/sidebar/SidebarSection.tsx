/**
 * SidebarSection Component
 * 
 * Grouped section component for sidebar menu items.
 * Handles section labeling and item grouping.
 */

import { MenuSection } from '@/config/sidebar-menu.config';
import { SidebarItem } from './SidebarItem';
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarSectionProps {
  section: MenuSection;
  activePath?: string;
}

export function SidebarSection({ section, activePath }: SidebarSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="mb-4">
      {/* Section Header */}
      <button
        onClick={toggleExpanded}
        className={cn(
          'flex items-center w-full px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400',
          'hover:text-gray-700 dark:hover:text-gray-200',
          'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500',
          'transition-colors'
        )}
      >
        <span className="flex-1 text-left uppercase tracking-wider">{section.label}</span>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        )}
      </button>

      {/* Section Items */}
      {isExpanded && (
        <div className="mt-1 space-y-1">
          {section.items.map((item) => {
            const isItemActive =
              activePath === item.path ||
              (item.children?.some((child) => child.path === activePath) ?? false);

            return (
              <SidebarItem
                key={item.id}
                item={item}
                activePath={activePath}
                isActive={isItemActive}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
