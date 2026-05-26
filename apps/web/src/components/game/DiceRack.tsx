import type { CSSProperties } from 'react';

interface Props {
  dice: [number, number, number, number, number];
  kept: [boolean, boolean, boolean, boolean, boolean];
  canKeep: boolean;
  rolling: boolean;
  onToggle: (index: number) => void;
}

export function DiceRack({ dice, kept, canKeep, rolling, onToggle }: Props) {
  return (
    <div className="dice-rack">
      <div className="dice-grid bare">
        {dice.map((value, index) => renderDie(value, index, kept[index], index))}
      </div>
    </div>
  );

  function renderDie(value: number, index: number, isKept: boolean, order: number) {
    return (
      <button
        key={index}
        className={`die ${isKept ? 'kept' : ''} ${rolling && !isKept ? 'rolling' : ''}`}
        disabled={!canKeep}
        onClick={() => onToggle(index)}
        aria-label={`die-${index + 1}-${value}`}
        style={
          {
            '--value': value,
            '--delay': `${order * 12}ms`,
          } as CSSProperties
        }
      >
        <div className="die-shell">
          <div className="die-face">{renderPips(value)}</div>
        </div>
      </button>
    );
  }
}

function renderPips(value: number) {
  const activeCellsByValue: Record<number, number[]> = {
    1: [5],
    2: [1, 9],
    3: [1, 5, 9],
    4: [1, 3, 7, 9],
    5: [1, 3, 5, 7, 9],
    6: [1, 3, 4, 6, 7, 9],
  };

  return (
    <span className="pips">
      {Array.from({ length: 9 }).map((_, index) => (
        <span key={index} className={`pip-slot ${activeCellsByValue[value].includes(index + 1) ? 'filled' : ''}`}>
          <span className="pip" />
        </span>
      ))}
    </span>
  );
}
