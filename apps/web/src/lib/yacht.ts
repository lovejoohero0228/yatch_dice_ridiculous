import type { CategoryId } from '../types';

export function calcScore(categoryId: CategoryId, dice: number[]): number {
  const counts = Array(6).fill(0);
  for (const d of dice) counts[d - 1] += 1;
  const sum = dice.reduce((a, b) => a + b, 0);

  switch (categoryId) {
    case 'ones':
      return counts[0] * 1;
    case 'twos':
      return counts[1] * 2;
    case 'threes':
      return counts[2] * 3;
    case 'fours':
      return counts[3] * 4;
    case 'fives':
      return counts[4] * 5;
    case 'sixes':
      return counts[5] * 6;
    case 'choice':
      return sum;
    case '4oak':
      return counts.some((c) => c >= 4) ? sum : 0;
    case 'fh': {
      const has3 = counts.some((c) => c === 3);
      const has2 = counts.some((c) => c === 2);
      return has3 && has2 ? sum : 0;
    }
    case 'ss': {
      const s = new Set(dice);
      const runs = [
        [1, 2, 3, 4],
        [2, 3, 4, 5],
        [3, 4, 5, 6],
      ];
      return runs.some((r) => r.every((n) => s.has(n))) ? 15 : 0;
    }
    case 'ls': {
      const s = new Set(dice);
      const runA = [1, 2, 3, 4, 5].every((n) => s.has(n));
      const runB = [2, 3, 4, 5, 6].every((n) => s.has(n));
      return runA || runB ? 30 : 0;
    }
    case 'yacht':
      return dice.every((d) => d === dice[0]) ? 50 : 0;
    default:
      return 0;
  }
}

export function calcUpperBonus(scores: Partial<Record<CategoryId, number>>): number {
  const upper: CategoryId[] = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];
  const total = upper.reduce((sum, id) => sum + (scores[id] ?? 0), 0);
  return total >= 63 ? 35 : 0;
}

export function calcTotal(scores: Partial<Record<CategoryId, number>>): number {
  return Object.values(scores).reduce((a, b) => a + (b ?? 0), 0) + calcUpperBonus(scores);
}
