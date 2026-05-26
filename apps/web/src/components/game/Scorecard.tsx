import type { CategoryId, Player } from '../../types';
import { CATEGORY_LABELS } from '../../types';
import { calcScore, calcUpperBonus } from '../../lib/yacht';

interface Props {
  dice: number[];
  rolled: boolean;
  currentPlayer: number;
  players: [Player, Player];
  selectedCategory: CategoryId | null;
  onSelect: (categoryId: CategoryId) => void;
}

const UPPER_SECTION: CategoryId[] = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];
const MAJOR_SECTION: CategoryId[] = ['3oak', '4oak', 'fh', 'ss', 'ls', 'yacht', 'choice'];

export function Scorecard({ dice, rolled, currentPlayer, players, selectedCategory, onSelect }: Props) {
  const upperOne = UPPER_SECTION.reduce((sum, category) => sum + (players[0].scores[category] ?? 0), 0);
  const upperTwo = UPPER_SECTION.reduce((sum, category) => sum + (players[1].scores[category] ?? 0), 0);
  const isInteractiveTurn = currentPlayer === 0;

  function renderRow(category: CategoryId) {
    const p1 = players[0].scores[category];
    const p2 = players[1].scores[category];
    const taken = players[currentPlayer].scores[category] !== undefined;
    const preview = rolled ? calcScore(category, dice) : '-';
    const p1Display = p1 ?? (currentPlayer === 0 && !taken && rolled ? preview : '-');
    const p2Display = p2 ?? (currentPlayer === 1 && !taken && rolled ? preview : '-');

    return (
      <button
        key={category}
        className={`scorecard-row ${selectedCategory === category ? 'selected-row' : ''}`}
        disabled={!rolled || taken || !isInteractiveTurn}
        onClick={() => onSelect(category)}
      >
        <span className="scorecard-cell scorecard-label">{CATEGORY_LABELS[category]}</span>
        <span
          className={`scorecard-cell player-cell player-one ${p1 !== undefined ? 'locked-value' : currentPlayer === 0 && rolled && !taken ? 'preview-value' : ''} ${selectedCategory === category && currentPlayer === 0 ? 'selected-player-cell' : ''}`}
        >
          {p1Display}
        </span>
        <span
          className={`scorecard-cell player-cell player-two ${p2 !== undefined ? 'locked-value' : currentPlayer === 1 && rolled && !taken ? 'preview-value' : ''} ${selectedCategory === category && currentPlayer === 1 ? 'selected-player-cell' : ''}`}
        >
          {p2Display}
        </span>
      </button>
    );
  }

  return (
    <section className="panel scorecard-board">
      <div className="scorecard-header">
        <div className="scorecard-title">Minor</div>
        <div className="scorecard-title">Major</div>
      </div>

      <div className="scorecard-columns">
        <section className="scorecard-column minor-column">
          {UPPER_SECTION.map(renderRow)}
          <div className="bonus-strip" aria-hidden="true">
            <div className="bonus-copy">
              <span>Bonus</span>
              <strong>+35</strong>
            </div>
            <div className="bonus-score">{upperOne}<small>/63</small></div>
            <div className="bonus-score">{upperTwo}<small>/63</small></div>
          </div>
        </section>

        <section className="scorecard-column major-column">
          {MAJOR_SECTION.map(renderRow)}
        </section>
      </div>
    </section>
  );
}
