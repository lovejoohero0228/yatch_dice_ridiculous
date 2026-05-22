import { useMemo, useState } from 'react';
import { calcScore, calcTotal } from '../lib/yacht';
import type { CategoryId, GameMode, GameState, Player } from '../types';

const EMPTY_DICE: [number, number, number, number, number] = [1, 1, 1, 1, 1];
const EMPTY_KEPT: [boolean, boolean, boolean, boolean, boolean] = [false, false, false, false, false];

function createPlayer(name: string, isBot: boolean): Player {
  return {
    id: crypto.randomUUID(),
    name,
    avatar: isBot ? 'BOT' : 'YOU',
    isBot,
    scores: {},
    totalScore: 0,
  };
}

function roll(kept: boolean[], prev: number[]): [number, number, number, number, number] {
  return prev.map((v, i) => (kept[i] ? v : Math.floor(Math.random() * 6) + 1)) as [number, number, number, number, number];
}

export function useYachtGame(mode: GameMode = 'bot') {
  const [state, setState] = useState<GameState>({
    mode,
    players: [createPlayer('Player 1', false), createPlayer(mode === 'bot' ? 'Bot' : 'Player 2', mode === 'bot')],
    currentPlayer: 0,
    dice: EMPTY_DICE,
    kept: EMPTY_KEPT,
    rollsLeft: 3,
    rolled: false,
    round: 1,
  });

  const winner = useMemo(() => {
    if (state.round <= 12) return null;
    const [a, b] = state.players;
    if (a.totalScore === b.totalScore) return null;
    return a.totalScore > b.totalScore ? 0 : 1;
  }, [state.players, state.round]);

  function setKept(next: [boolean, boolean, boolean, boolean, boolean]) {
    setState((s) => ({ ...s, kept: next }));
  }

  function toggleKeep(index: number) {
    setState((s) => {
      if (!s.rolled || s.rollsLeft === 3) return s;
      const kept = [...s.kept] as [boolean, boolean, boolean, boolean, boolean];
      kept[index] = !kept[index];
      return { ...s, kept };
    });
  }

  function rollDice() {
    setState((s) => {
      if (s.rollsLeft <= 0) return s;
      const dice = roll(s.kept, s.dice);
      return {
        ...s,
        dice,
        rollsLeft: s.rollsLeft - 1,
        rolled: true,
      };
    });
  }

  function selectCategory(categoryId: CategoryId) {
    setState((s) => {
      if (!s.rolled) return s;
      const current = s.currentPlayer;
      if (s.players[current].scores[categoryId] !== undefined) return s;

      const players = [...s.players] as [Player, Player];
      const player = { ...players[current] };
      const scores = { ...player.scores, [categoryId]: calcScore(categoryId, s.dice) };
      player.scores = scores;
      player.totalScore = calcTotal(scores);
      players[current] = player;

      const nextCurrent = (s.currentPlayer === 0 ? 1 : 0) as 0 | 1;
      const finishedTurnPair = s.currentPlayer === 1;
      const nextRound = finishedTurnPair ? s.round + 1 : s.round;

      return {
        ...s,
        players,
        currentPlayer: nextCurrent,
        dice: EMPTY_DICE,
        kept: EMPTY_KEPT,
        rollsLeft: 3,
        rolled: false,
        round: nextRound,
      };
    });
  }

  return {
    ...state,
    winner,
    setKept,
    toggleKeep,
    rollDice,
    selectCategory,
  };
}
