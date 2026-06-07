import type { MenuSection } from '@/config/sidebar-menu.config';
import {
  LayoutDashboard,
  DollarSign,
  BookOpen,
  ClipboardList,
  AlertTriangle,
  Award,
  Settings,
} from 'lucide-react';

export const studentSidebarMenuConfig: MenuSection[] = [
  {
    id: 'main',
    label: 'Main',
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        path: '/dashboard',
        icon: LayoutDashboard,
      },
    ],
  },
  {
    id: 'student-portal',
    label: 'Student portal',
    items: [
      {
        id: 'financial',
        label: 'Financial',
        path: '/portal/fees-payment',
        icon: DollarSign,
        children: [
          { id: 'fees-payment', label: 'Fees payment', path: '/portal/fees-payment' },
          { id: 'fees-payment-pdf', label: 'Fees payment PDF', path: '/portal/fees-payment-pdf' },
          { id: 'fee-statement', label: 'Fee statement', path: '/portal/fee-statement' },
        ],
      },
      {
        id: 'academics',
        label: 'Academics',
        path: '/portal/register-units',
        icon: BookOpen,
        children: [
          { id: 'register-units', label: 'Register units', path: '/portal/register-units' },
          { id: 'provisional-results-slip', label: 'Provisional results slip', path: '/portal/provisional-results-slip' },
          { id: 'provisional-transcript', label: 'Provisional transcript', path: '/portal/provisional-transcript' },
        ],
      },
      {
        id: 'student-requests',
        label: 'Student requests',
        path: '/portal/deferment',
        icon: ClipboardList,
        children: [
          { id: 'deferment', label: 'Deferment', path: '/portal/deferment' },
          { id: 'withdrawal', label: 'Withdrawal', path: '/portal/withdrawal' },
        ],
      },
      {
        id: 'special-exams',
        label: 'Special exams',
        path: '/portal/resit-exams',
        icon: AlertTriangle,
        children: [
          { id: 'resit-exams', label: 'Resit exams registration', path: '/portal/resit-exams' },
          { id: 'special-exam-registration', label: 'Special exam registration', path: '/portal/special-exam-registration' },
        ],
      },
      {
        id: 'student-clearance',
        label: 'Student clearance',
        path: '/portal/graduation-clearance',
        icon: Award,
        children: [
          { id: 'graduation-clearance', label: 'Graduation clearance', path: '/portal/graduation-clearance' },
        ],
      },
      {
        id: 'settings',
        label: 'Settings',
        path: '/portal/change-password',
        icon: Settings,
        children: [
          { id: 'change-password', label: 'Change password', path: '/portal/change-password' },
        ],
      },
    ],
  },
];