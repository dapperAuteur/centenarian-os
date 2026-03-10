// lib/features/lister-features.ts
// Feature page configs for Lister (CrewOps) app.

import type { FeatureConfig } from './contractor-features';

export const LISTER_FEATURES: FeatureConfig[] = [
  {
    slug: 'dashboard',
    title: 'Lister Dashboard',
    tagline: 'Your crew operation at a glance.',
    description:
      'See everything that matters in one view: total jobs, upcoming assignments, roster size, fill rates, pending offers, and unread messages. Quick-action buttons let you create a job, assign a contractor, or send a message without navigating away. The dashboard is your command center for managing crew.',
    highlights: [
      'Real-time stats: jobs, roster, fill rate, offers',
      'Quick actions: create job, assign, message',
      'Upcoming jobs with dates and details',
      'Unread message count and alerts',
      'One-glance overview of your entire operation',
    ],
    demoRedirect: '/dashboard/contractor/lister',
    icon: 'ClipboardList',
    group: 'Crew',
  },
  {
    slug: 'jobs',
    title: 'Job Creation',
    tagline: 'Create jobs that need crew. Fill them fast.',
    description:
      'Create and manage jobs that need contractors. Set dates, locations, rates, department requirements, and any special instructions. Each job tracks how many positions you need to fill and how many have been accepted. Monitor job status from creation through completion.',
    highlights: [
      'Create jobs with dates, locations, and rates',
      'Set department and skill requirements',
      'Track fill status per job',
      'Monitor from creation through completion',
      'Link to venues for location details',
    ],
    demoRedirect: '/dashboard/contractor/jobs',
    icon: 'Briefcase',
    group: 'Crew',
  },
  {
    slug: 'roster',
    title: 'Crew Roster',
    tagline: 'Your contractors, organized and ready.',
    description:
      'Build and maintain your roster of contractors. Each entry includes name, email, phone, skills (camera op, audio, utility, etc.), and availability notes. When you need to staff a job, your roster is the first place you look — searchable by name, skill, or availability.',
    highlights: [
      'Add contractors with contact info and skills',
      'Skill tags for easy filtering',
      'Availability notes per contractor',
      'Search by name, email, or skill',
      'Link to platform accounts for direct assignment',
    ],
    demoRedirect: '/dashboard/contractor/lister/roster',
    icon: 'Users',
    group: 'Crew',
  },
  {
    slug: 'assign',
    title: 'Job Assignment',
    tagline: 'Match the right contractor to the right job.',
    description:
      'Assign contractors from your roster to specific jobs. Each assignment sends an offer to the contractor with job details and your message. Track offer status in real time: offered, accepted, declined, or removed. See responses and manage your assignments from one central view.',
    highlights: [
      'Assign roster members to any job',
      'Include custom messages with offers',
      'Real-time status: offered, accepted, declined',
      'Filter by status to see pending offers',
      'Contractor responses visible inline',
    ],
    demoRedirect: '/dashboard/contractor/lister/assign',
    icon: 'UserPlus',
    group: 'Crew',
  },
  {
    slug: 'availability',
    title: 'Availability Calendar',
    tagline: 'See who\'s available before you assign.',
    description:
      'View contractor availability at a glance before making assignments. The calendar shows which contractors are free, which are booked, and which have notes about their schedule. Plan your staffing around real availability instead of playing phone tag.',
    highlights: [
      'Calendar view of contractor availability',
      'See booked vs free at a glance',
      'Availability notes from contractors',
      'Plan assignments around real schedules',
      'Avoid double-booking contractors',
    ],
    demoRedirect: '/dashboard/contractor/lister/availability',
    icon: 'CalendarCheck',
    group: 'Communication',
  },
  {
    slug: 'messages',
    title: 'Crew Messaging',
    tagline: 'Reach your crew — one person or the whole team.',
    description:
      'Send messages to individual contractors or entire groups. Use message groups to organize by department (Camera, Audio) or location (Indianapolis Crew). Every message is tracked with read status so you know who\'s seen your updates. Keep all crew communication in one place.',
    highlights: [
      'Individual and group messaging',
      'Message groups by department or location',
      'Read status tracking per message',
      'Inbox and sent folder organization',
      'Subject lines for easy reference',
    ],
    demoRedirect: '/dashboard/contractor/lister/messages',
    icon: 'Send',
    group: 'Communication',
  },
  {
    slug: 'groups',
    title: 'Message Groups',
    tagline: 'Organize your crew for targeted communication.',
    description:
      'Create message groups like "Camera Department," "Audio Team," or "Indianapolis Crew" and add roster members. When you need to send updates to a specific subset of your contractors, select the group and everyone gets the message. Manage group membership as your crew evolves.',
    highlights: [
      'Create groups by department, skill, or location',
      'Add/remove roster members from groups',
      'Send group messages with one action',
      'Manage multiple groups for different needs',
      'Group descriptions for context',
    ],
    demoRedirect: '/dashboard/contractor/lister/groups',
    icon: 'UsersRound',
    group: 'Communication',
  },
  {
    slug: 'reports',
    title: 'Reports',
    tagline: 'Measure your operation. Improve it.',
    description:
      'Analyze fill rates, contractor performance, and job metrics across your operation. See which contractors accept the most offers, which jobs are hardest to staff, and how your fill rate trends over time. Use data to improve your crew management and client satisfaction.',
    highlights: [
      'Fill rate analytics over time',
      'Contractor acceptance rates',
      'Job staffing difficulty analysis',
      'Date range filtering',
      'Exportable report data',
    ],
    demoRedirect: '/dashboard/contractor/reports',
    icon: 'BarChart3',
    group: 'Analytics',
  },
];

export function getListerFeature(slug: string): FeatureConfig | undefined {
  return LISTER_FEATURES.find((f) => f.slug === slug);
}

export const LISTER_FEATURE_GROUPS = [
  { label: 'Crew', slugs: ['dashboard', 'jobs', 'roster', 'assign'] },
  { label: 'Communication', slugs: ['availability', 'messages', 'groups'] },
  { label: 'Analytics', slugs: ['reports'] },
];
