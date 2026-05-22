import type { CategoryId } from '../types';
import { calcScore } from './yacht';

export function botDecideKeep(dice: number[], _remainingCategories: CategoryId[]): boolean[] {
  const counts = Array(6).fill(0);
  for (const d of dice) counts[d - 1] += 1;
  const maxCount = Math.max(...counts);
  const bestVal = counts.indexOf(maxCount) + 1;

  if (maxCount >= 4) return dice.map((d) => d === bestVal);

  const s = new Set(dice);
  if (s.size >= 4) {
    return dice.map((_, i) => {
      const without = dice.filter((__, j) => j !== i);
      return new Set(without).size >= 4;
    });
  }

  return dice.map((d) => d === bestVal || d >= 5);
}

export function botChooseCategory(dice: number[], available: CategoryId[]): CategoryId {
  let best = available[0];
  let bestScore = -1;
  for (const cat of available) {
    const score = calcScore(cat, dice);
    if (score > bestScore) {
      bestScore = score;
      best = cat;
    }
  }
  return best;
}

export const BOT_THINK_DELAY = { min: 800, max: 2000 };
export const BOT_ROLL_DELAY = { min: 600, max: 1200 };
