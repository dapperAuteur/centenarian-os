// lib/utils/tagUtils.ts

/**
 * Predefined tags for focus sessions
 * Users can categorize their work for better insights
 */

export interface Tag {
  id: string;
  label: string;
  color: string;
  description: string;
  icon?: string;
}

export const PREDEFINED_TAGS: Tag[] = [
  {
    id: 'deep-work',
    label: 'Deep Work',
    color: 'indigo',
    description: 'Focused, uninterrupted work on complex tasks',
    icon: '🧠',
  },
  {
    id: 'meeting',
    label: 'Meeting',
    color: 'blue',
    description: 'Client calls, team meetings, video conferences',
    icon: '👥',
  },
  {
    id: 'admin',
    label: 'Admin',
    color: 'gray',
    description: 'Email, scheduling, paperwork, organization',
    icon: '📋',
  },
  {
    id: 'learning',
    label: 'Learning',
    color: 'purple',
    description: 'Research, courses, reading, skill development',
    icon: '📚',
  },
  {
    id: 'creative',
    label: 'Creative',
    color: 'pink',
    description: 'Design, writing, brainstorming, ideation',
    icon: '🎨',
  },
  {
    id: 'coding',
    label: 'Coding',
    color: 'green',
    description: 'Programming, debugging, code review',
    icon: '💻',
  },
  {
    id: 'planning',
    label: 'Planning',
    color: 'amber',
    description: 'Strategy, roadmapping, project planning',
    icon: '🗓️',
  },
  {
    id: 'review',
    label: 'Review',
    color: 'cyan',
    description: 'QA, code review, proofreading, feedback',
    icon: '✅',
  },
];

/**
 * Get tag by ID
 */
export function getTagById(id: string): Tag | undefined {
  return PREDEFINED_TAGS.find(tag => tag.id === id);
}

/**
 * Get color classes for a tag
 */
export function getTagColorClasses(color: string): {
  bg: string;
  text: string;
  border: string;
  hoverBg: string;
} {
  const colorMap: Record<string, { bg: string; text: string; border: string; hoverBg: string }> = {
    indigo: {
      bg: 'bg-indigo-100',
      text: 'text-indigo-800',
      border: 'border-indigo-300',
      hoverBg: 'hover:bg-indigo-200',
    },
    blue: {
      bg: 'bg-blue-100',
      text: 'text-blue-800',
      border: 'border-blue-300',
      hoverBg: 'hover:bg-blue-200',
    },
    gray: {
      bg: 'bg-gray-100',
      text: 'text-gray-800',
      border: 'border-gray-300',
      hoverBg: 'hover:bg-gray-200',
    },
    purple: {
      bg: 'bg-purple-100',
      text: 'text-purple-800',
      border: 'border-purple-300',
      hoverBg: 'hover:bg-purple-200',
    },
    pink: {
      bg: 'bg-pink-100',
      text: 'text-pink-800',
      border: 'border-pink-300',
      hoverBg: 'hover:bg-pink-200',
    },
    green: {
      bg: 'bg-green-100',
      text: 'text-green-800',
      border: 'border-green-300',
      hoverBg: 'hover:bg-green-200',
    },
    amber: {
      bg: 'bg-amber-100',
      text: 'text-amber-800',
      border: 'border-amber-300',
      hoverBg: 'hover:bg-amber-200',
    },
    cyan: {
      bg: 'bg-cyan-100',
      text: 'text-cyan-800',
      border: 'border-cyan-300',
      hoverBg: 'hover:bg-cyan-200',
    },
  };

  return colorMap[color] || colorMap.gray;
}

/**
 * Format tags for display
 */
export function formatTags(tags: string[]): string {
  if (!tags || tags.length === 0) return 'No tags';
  return tags
    .map(tagId => {
      const tag = getTagById(tagId);
      return tag ? tag.label : tagId;
    })
    .join(', ');
}