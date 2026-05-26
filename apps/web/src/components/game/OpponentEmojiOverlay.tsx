interface Props {
  emoji: string;
  text: string;
  from: string;
  nonce: number;
}

export function OpponentEmojiOverlay({ emoji, text, from, nonce }: Props) {
  return (
    <aside key={nonce} className="taunt-overlay" role="status" aria-live="polite">
      <div className="taunt-burst" />
      <div className="taunt-card">
        <span className="taunt-emoji">{emoji}</span>
        <strong>{from}</strong>
        <p>{text}</p>
      </div>
    </aside>
  );
}
