// components/nav/NavConfig.ts
// Single source of truth for dashboard navigation groups and items.

import {
  CalendarClock,
  Briefcase,
  FileText,
  Map,
  Utensils,
  HeartPulse,
  Watch,
  TrendingUp,
  ChartNetwork,
  DollarSign,
  Navigation,
  BookOpen,
  ChefHat,
  GraduationCap,
  Radio,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  paid: boolean;
}

export interface NavGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'operate',
    label: 'Operate',
    icon: CalendarClock,
    items: [
      { label: 'Daily Tasks', href: '/dashboard/planner', icon: CalendarClock, paid: true },
      { label: 'Engine', href: '/dashboard/engine', icon: Briefcase, paid: true },
      { label: 'Weekly Review', href: '/dashboard/weekly-review', icon: FileText, paid: true },
      { label: 'Roadmap', href: '/dashboard/roadmap', icon: Map, paid: true },
    ],
  },
  {
    id: 'health',
    label: 'Health',
    icon: HeartPulse,
    items: [
      { label: 'Fuel', href: '/dashboard/fuel', icon: Utensils, paid: true },
      { label: 'Metrics', href: '/dashboard/metrics', icon: HeartPulse, paid: true },
      { label: 'Wearables', href: '/dashboard/settings/wearables', icon: Watch, paid: true },
      { label: 'Correlations', href: '/dashboard/correlations', icon: TrendingUp, paid: true },
      { label: 'Analytics', href: '/dashboard/analytics', icon: ChartNetwork, paid: true },
    ],
  },
  {
    id: 'life',
    label: 'Life',
    icon: Navigation,
    items: [
      { label: 'Finance', href: '/dashboard/finance', icon: DollarSign, paid: true },
      { label: 'Travel', href: '/dashboard/travel', icon: Navigation, paid: true },
    ],
  },
  {
    id: 'learn',
    label: 'Learn',
    icon: GraduationCap,
    items: [
      { label: 'Blog', href: '/dashboard/blog', icon: BookOpen, paid: false },
      { label: 'Recipes', href: '/dashboard/recipes', icon: ChefHat, paid: false },
      { label: 'Academy', href: '/academy', icon: GraduationCap, paid: false },
      { label: 'Live', href: '/live', icon: Radio, paid: false },
    ],
  },
];

export function isGroupActive(group: NavGroup, pathname: string): boolean {
  return group.items.some((item) => isItemActive(item.href, pathname));
}

export function isItemActive(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(href + '/');
}
