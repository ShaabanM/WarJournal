/**
 * Lightweight client-side sentiment analysis for mood text.
 * Derives a color from free-text mood descriptions.
 */

// Legacy mood → color map (backward compat with old enum values)
const LEGACY_MOOD_COLORS: Record<string, string> = {
  hopeful: '#7cb881',
  anxious: '#d97c7c',
  grateful: '#7cb881',
  reflective: '#8a8580',
  determined: '#a3b07c',
  somber: '#c98a7c',
  joyful: '#7cb881',
  exhausted: '#d97c7c',
};

const POSITIVE_WORDS = new Set([
  'grateful', 'hopeful', 'happy', 'peaceful', 'relieved', 'blessed', 'joyful',
  'excited', 'content', 'optimistic', 'proud', 'thankful', 'calm', 'inspired',
  'love', 'wonderful', 'amazing', 'great', 'good', 'safe', 'free', 'warm',
  'alive', 'strong', 'determined', 'motivated', 'confident', 'cheerful',
  'delighted', 'elated', 'glad', 'thrilled', 'serene', 'secure', 'comfortable',
]);

const NEGATIVE_WORDS = new Set([
  'anxious', 'scared', 'exhausted', 'desperate', 'angry', 'lost', 'worried',
  'afraid', 'terrified', 'hopeless', 'sad', 'depressed', 'frustrated',
  'miserable', 'broken', 'lonely', 'trapped', 'overwhelmed', 'dread',
  'somber', 'grief', 'pain', 'hurt', 'tired', 'weary', 'numb', 'helpless',
  'confused', 'uncertain', 'restless', 'nervous', 'tense', 'uneasy',
  'heartbroken', 'devastated', 'bitter', 'resentful', 'defeated',
]);

/**
 * Analyze sentiment of text. Returns a score from -1 (negative) to +1 (positive).
 */
export function analyzeSentiment(text: string): number {
  const words = text.toLowerCase().split(/\s+/);
  let pos = 0;
  let neg = 0;

  for (const word of words) {
    // Strip common punctuation
    const clean = word.replace(/[^a-z]/g, '');
    if (POSITIVE_WORDS.has(clean)) pos++;
    if (NEGATIVE_WORDS.has(clean)) neg++;
  }

  if (pos + neg === 0) return 0; // neutral
  return Math.max(-1, Math.min(1, (pos - neg) / Math.max(pos + neg, 1)));
}

/**
 * Map a sentiment score (-1 to +1) to a color via HSL interpolation.
 * -1 (negative) → muted red (#c98a7c)
 *  0 (neutral)  → warm gray (#8a8580)
 * +1 (positive) → sage green (#7cb881)
 */
export function sentimentToColor(score: number): string {
  // Clamp
  const s = Math.max(-1, Math.min(1, score));

  // HSL interpolation:
  // negative: hsl(12, 32%, 64%)  → muted terracotta
  // neutral:  hsl(30, 4%, 53%)   → warm gray
  // positive: hsl(135, 24%, 60%) → sage green

  let h: number, sat: number, l: number;

  if (s <= 0) {
    // Interpolate from neutral (0) to negative (-1)
    const t = Math.abs(s);
    h = 30 + (12 - 30) * t;    // 30 → 12
    sat = 4 + (32 - 4) * t;     // 4% → 32%
    l = 53 + (64 - 53) * t;     // 53% → 64%
  } else {
    // Interpolate from neutral (0) to positive (+1)
    const t = s;
    h = 30 + (135 - 30) * t;   // 30 → 135
    sat = 4 + (24 - 4) * t;     // 4% → 24%
    l = 53 + (60 - 53) * t;     // 53% → 60%
  }

  return `hsl(${Math.round(h)}, ${Math.round(sat)}%, ${Math.round(l)}%)`;
}

/**
 * Get a color for a mood string. Checks the legacy map first for backward compat,
 * then falls back to sentiment analysis.
 */
export function getMoodColor(mood: string | undefined): string {
  if (!mood) return '#8a8580'; // neutral gray

  // Check legacy map first
  const legacy = LEGACY_MOOD_COLORS[mood.toLowerCase()];
  if (legacy) return legacy;

  // Fall back to sentiment analysis
  const score = analyzeSentiment(mood);
  return sentimentToColor(score);
}
