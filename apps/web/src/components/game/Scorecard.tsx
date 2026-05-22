import type { CategoryId, Player } from '../../types';
import { CATEGORIES, CATEGORY_LABELS } from '../../types';
import { calcScore } from '../../lib/yacht';

interface Props {
  dice: number[];
  rolled: boolean;
  currentPlayer: number;
  players: [Player, Player];
  onSelect: (categoryId: CategoryId) => void;
}

export function Scorecard({ dice, rolled, currentPlayer, players, onSelect }: Props) {
  return (
    <div className="panel">
      <h2>Scorecard</h2>
      {CATEGORIES.map((category) => {
        const p1 = players[0].scores[category];
        const p2 = players[1].scores[category];
        const taken = players[currentPlayer].scores[category] !== undefined;
        const preview = rolled ? calcScore(category, dice) : '-';
        return (
          <button
            key={category}
            className="row"
            disabled={!rolled || taken}
            onClick={() => onSelect(category)}
          >
            <span>{CATEGORY_LABELS[category]}</span>
            <span>{p1 ?? '-'}</span>
            <span>{p2 ?? '-'}</span>
            <span>{taken ? 'Taken' : preview}</span>
          </button>
        );
      })}
    </div>
  );
}
