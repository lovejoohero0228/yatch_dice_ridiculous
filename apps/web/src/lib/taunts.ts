export const TAUNTS = [
  { emoji: '💤', text: '' },
  { emoji: '👍', text: '' },
  { emoji: '🥳', text: '' },
  { emoji: '🥱', text: '' },
  { emoji: '💩', text: '' },
  { emoji: '💦', text: '' },
];

export function randomTaunt() {
  return TAUNTS[Math.floor(Math.random() * TAUNTS.length)];
}
