import { TaskTag } from '@/lib/types';

export const TAGS: TaskTag[] = ['FITNESS', 'CREATIVE', 'SKILL', 'OUTREACH', 'LIFESTYLE', 'MINDSET', 'FUEL'];

export const TAG_COLORS: Record<TaskTag, string> = {
  FITNESS: 'bg-green-100 text-green-700 border-green-300',
  CREATIVE: 'bg-purple-100 text-purple-700 border-purple-300',
  SKILL: 'bg-blue-100 text-blue-700 border-blue-300',
  OUTREACH: 'bg-orange-100 text-orange-700 border-orange-300',
  LIFESTYLE: 'bg-pink-100 text-pink-700 border-pink-300',
  MINDSET: 'bg-indigo-100 text-indigo-700 border-indigo-300',
  FUEL: 'bg-yellow-100 text-yellow-700 border-yellow-300',
};
