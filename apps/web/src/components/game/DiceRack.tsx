interface Props {
  dice: [number, number, number, number, number];
  kept: [boolean, boolean, boolean, boolean, boolean];
  canKeep: boolean;
  onToggle: (index: number) => void;
}

export function DiceRack({ dice, kept, canKeep, onToggle }: Props) {
  return (
    <div className="dice-rack">
      {dice.map((value, idx) => (
        <button
          key={idx}
          className={`die ${kept[idx] ? 'kept' : ''}`}
          disabled={!canKeep}
          onClick={() => onToggle(idx)}
        >
          <span className="value">{value}</span>
          {kept[idx] && <span className="tag">KEEP</span>}
        </button>
      ))}
    </div>
  );
}
