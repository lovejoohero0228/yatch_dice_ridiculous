import { DiceRack } from './components/game/DiceRack';
import { Scorecard } from './components/game/Scorecard';
import { useBotAI } from './hooks/useBotAI';
import { useYachtGame } from './hooks/useYachtGame';

export default function App() {
  const game = useYachtGame('bot');
  useBotAI(game);

  return (
    <main className="page">
      <h1>Yacht Dice</h1>
      <div className="meta">
        <span>Round {Math.min(game.round, 12)} / 12</span>
        <span>Current: {game.players[game.currentPlayer].name}</span>
        <span>Rolls Left: {game.rollsLeft}</span>
      </div>

      <DiceRack
        dice={game.dice}
        kept={game.kept}
        canKeep={game.rolled && game.rollsLeft < 3 && game.currentPlayer === 0}
        onToggle={game.toggleKeep}
      />

      <div className="actions">
        <button
          className="roll"
          onClick={game.rollDice}
          disabled={game.rollsLeft <= 0 || game.currentPlayer !== 0 || game.round > 12}
        >
          Roll Dice
        </button>
      </div>

      <Scorecard
        dice={game.dice}
        rolled={game.rolled}
        currentPlayer={game.currentPlayer}
        players={game.players}
        onSelect={game.selectCategory}
      />

      <div className="totals">
        <div>{game.players[0].name}: {game.players[0].totalScore}</div>
        <div>{game.players[1].name}: {game.players[1].totalScore}</div>
        {game.round > 12 && (
          <strong>
            Result: {game.winner === null ? 'Draw' : `${game.players[game.winner].name} wins`}
          </strong>
        )}
      </div>
    </main>
  );
}
