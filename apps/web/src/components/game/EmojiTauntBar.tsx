import { TAUNTS } from '../../lib/taunts';

interface Props {
  disabled?: boolean;
  onSend: (emoji: string) => void;
}

export function EmojiTauntBar({ disabled = false, onSend }: Props) {
  return (
    <section className="taunt-panel" aria-label="taunt-panel">
      <div className="taunt-list">
        {TAUNTS.map((taunt) => (
          <button
            key={taunt.emoji}
            className="taunt-btn"
            disabled={disabled}
            onClick={() => onSend(taunt.emoji)}
          >
            <span>{taunt.emoji}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
