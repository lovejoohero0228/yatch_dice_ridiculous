import { useEffect } from 'react';
import { BOT_ROLL_DELAY, BOT_THINK_DELAY, botChooseCategory, botDecideKeep } from '../lib/botAI';
import type { CategoryId } from '../types';
import { CATEGORIES } from '../types';
import { useYachtGame } from './useYachtGame';

function randMs(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function useBotAI(game: ReturnType<typeof useYachtGame>) {
  useEffect(() => {
    if (game.mode !== 'bot') return;
    if (game.currentPlayer !== 1) return;

    const timer = setTimeout(() => {
      if (game.rollsLeft > 0) {
        const open = CATEGORIES.filter((c) => game.players[1].scores[c] === undefined) as CategoryId[];
        const keep = botDecideKeep(game.dice, open);
        game.setKept(keep as [boolean, boolean, boolean, boolean, boolean]);
        game.rollDice();
        return;
      }

      const available = CATEGORIES.filter((c) => game.players[1].scores[c] === undefined) as CategoryId[];
      const cat = botChooseCategory(game.dice, available);
      game.selectCategory(cat);
    }, randMs(BOT_ROLL_DELAY.min, BOT_THINK_DELAY.max));

    return () => clearTimeout(timer);
  }, [game]);
}
