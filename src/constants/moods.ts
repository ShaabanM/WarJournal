import type { JournalEntry } from '../types';

export type MoodValue = NonNullable<JournalEntry['mood']>;

export interface MoodOption {
  value: MoodValue;
  emoji: string;
  label: string;
  color: string;
  description: string;
}

export const MOODS: MoodOption[] = [
  {
    value: 'hopeful',
    emoji: '🌅',
    label: 'Hopeful',
    color: '#59d38c',
    description: 'Moments where the horizon still feels open.',
  },
  {
    value: 'anxious',
    emoji: '😰',
    label: 'Anxious',
    color: '#ff8c42',
    description: 'Tension, uncertainty, and danger close at hand.',
  },
  {
    value: 'grateful',
    emoji: '🙏',
    label: 'Grateful',
    color: '#8f7bff',
    description: 'People, places, or mercies worth remembering.',
  },
  {
    value: 'reflective',
    emoji: '🪞',
    label: 'Reflective',
    color: '#59b7ff',
    description: 'A quieter pause to process what happened.',
  },
  {
    value: 'determined',
    emoji: '💪',
    label: 'Determined',
    color: '#ffbe3d',
    description: 'Resolve, forward motion, and stubborn momentum.',
  },
  {
    value: 'somber',
    emoji: '🌧️',
    label: 'Somber',
    color: '#7e8799',
    description: 'Heavy entries that carry loss or grief.',
  },
  {
    value: 'joyful',
    emoji: '✨',
    label: 'Joyful',
    color: '#ffe066',
    description: 'Bright spots that cut through the noise.',
  },
  {
    value: 'exhausted',
    emoji: '😮‍💨',
    label: 'Exhausted',
    color: '#ff6f6f',
    description: 'Spent, depleted, and running on willpower.',
  },
];

export const DEFAULT_MOOD_COLOR = '#f0a500';

export const MOOD_META = Object.fromEntries(
  MOODS.map((mood) => [mood.value, mood])
) as Record<MoodValue, MoodOption>;

export function getMoodMeta(mood?: JournalEntry['mood']): MoodOption | null {
  if (!mood) return null;
  return MOOD_META[mood];
}
