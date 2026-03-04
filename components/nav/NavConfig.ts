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
  Dumbbell,
  ListChecks,
  Sparkles,
  Bot,
  Gem,
  Package,
  ScanLine,
  Database,
  Tags,
  ChartLine,
  Inbox,
  RotateCcw,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  paid: boolean;
  adminOnly?: boolean;
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
      { label: 'Retrospective', href: '/dashboard/retrospective', icon: RotateCcw, paid: true },
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
      { label: 'Trends', href: '/dashboard/metrics/trends', icon: ChartLine, paid: true },
      { label: 'Wearables', href: '/dashboard/settings/wearables', icon: Watch, paid: true },
      { label: 'Workouts', href: '/dashboard/workouts', icon: Dumbbell, paid: true },
      { label: 'Exercises', href: '/dashboard/exercises', icon: ListChecks, paid: true },
      { label: 'Correlations', href: '/dashboard/correlations', icon: TrendingUp, paid: true },
      { label: 'Analytics', href: '/dashboard/analytics', icon: ChartNetwork, paid: true },
    ],
  },
  {
    id: 'life',
    label: 'Life',
    icon: Navigation,
    items: [
      { label: 'Scan', href: '/dashboard/scan', icon: ScanLine, paid: true },
      { label: 'Finance', href: '/dashboard/finance', icon: DollarSign, paid: true },
      { label: 'Travel', href: '/dashboard/travel', icon: Navigation, paid: true },
      { label: 'Equipment', href: '/dashboard/equipment', icon: Package, paid: true },
      { label: 'Data Hub', href: '/dashboard/data', icon: Database, paid: true },
      { label: 'Categories', href: '/dashboard/categories', icon: Tags, paid: true },
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
  {
    id: 'ai',
    label: 'AI',
    icon: Sparkles,
    items: [
      { label: 'Coach', href: '/dashboard/coach', icon: Bot, paid: true, adminOnly: true },
      { label: 'Gems', href: '/dashboard/gems', icon: Gem, paid: true, adminOnly: true },
      { label: 'Submissions', href: '/dashboard/admin/submissions', icon: Inbox, paid: false, adminOnly: true },
      { label: 'Invites', href: '/dashboard/admin/invites', icon: UserPlus, paid: false, adminOnly: true },
    ],
  },
];

export function getVisibleGroups(isAdmin: boolean, allowedModules?: string[] | null): NavGroup[] {
  return NAV_GROUPS
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => {
        if (i.adminOnly && !isAdmin) return false;
        // Invited users with module restrictions: only show allowed paid items
        if (allowedModules && i.paid) {
          return allowedModules.some((m) => i.href === m || i.href.startsWith(m + '/'));
        }
        return true;
      }),
    }))
    .filter((g) => g.items.length > 0);
}

export function isGroupActive(group: NavGroup, pathname: string): boolean {
  return group.items.some((item) => isItemActive(item.href, pathname));
}

export function isItemActive(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(href + '/');
}
