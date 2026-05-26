import type { CSSProperties } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DiceRack } from './components/game/DiceRack';
import { EmojiTauntBar } from './components/game/EmojiTauntBar';
import { Scorecard } from './components/game/Scorecard';
import { useBotAI } from './hooks/useBotAI';
import { randomTaunt } from './lib/taunts';
import { useYachtGame } from './hooks/useYachtGame';
import { CATEGORIES } from './types';

type OverlayState = {
  id: number;
  emoji: string;
  playerIndex: 0 | 1;
};

function randomDice(kept: boolean[], baseDice: [number, number, number, number, number]): [number, number, number, number, number] {
  return baseDice.map((value, index) => (kept[index] ? value : Math.floor(Math.random() * 6) + 1)) as [number, number, number, number, number];
}

export default function App() {
  const ROLL_LOCK_MS = 1000;
  const [selectedMode, setSelectedMode] = useState<'bot' | 'online'>('bot');
  const [introStep, setIntroStep] = useState<'menu' | 'online'>('menu');
  const [onlineChoice, setOnlineChoice] = useState<'idle' | 'create' | 'join'>('idle');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const generatedRoomCode = useMemo(() => Math.random().toString(36).slice(2, 8).toUpperCase(), []);
  const game = useYachtGame(selectedMode === 'bot' ? 'bot' : 'online');
  useBotAI(game);

  const [hasStarted, setHasStarted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [emojiBursts, setEmojiBursts] = useState<OverlayState[]>([]);
  const [isRollingAnim, setIsRollingAnim] = useState(false);
  const [isRollLocked, setIsRollLocked] = useState(false);
  const [previewDice, setPreviewDice] = useState<[number, number, number, number, number] | null>(null);
  const rollPreviewRef = useRef<number | null>(null);
  const rollFinalizeRef = useRef<number | null>(null);

  const totalRounds = CATEGORIES.length;
  const roundNow = Math.min(game.round, totalRounds);
  const isOver = game.round > totalRounds;
  const canRoll = game.rollsLeft > 0 && game.currentPlayer === 0 && !isOver && !isRollLocked;
  const shownDice = previewDice ?? game.dice;

  const winnerLabel = useMemo(() => {
    if (!isOver) return '';
    return game.winner === null ? 'DRAW' : `${game.players[game.winner].name} WINS`;
  }, [isOver, game.winner, game.players]);

  function pushTaunt(playerIndex: 0 | 1, emoji: string) {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setEmojiBursts((prev) => [...prev, { id, emoji, playerIndex }]);
    window.setTimeout(() => {
      setEmojiBursts((prev) => prev.filter((burst) => burst.id !== id));
    }, 2000);
  }

  function sendPlayerTaunt(emoji: string) {
    if (isOver) return;
    pushTaunt(0, emoji);
    const retaliate = randomTaunt();
    window.setTimeout(() => pushTaunt(1, retaliate.emoji), 850);
  }

  useEffect(() => {
    setMenuOpen(false);
  }, [game.currentPlayer, game.round]);

  useEffect(() => {
    if (previewDice) {
      setIsRollingAnim(true);
      return;
    }
    if (!game.rolled) return;
    setIsRollingAnim(true);
    const timer = window.setTimeout(() => setIsRollingAnim(false), 160);
    return () => window.clearTimeout(timer);
  }, [game.dice, game.rolled, previewDice]);

  useEffect(() => {
    return () => {
      if (rollPreviewRef.current !== null) window.clearInterval(rollPreviewRef.current);
      if (rollFinalizeRef.current !== null) window.clearTimeout(rollFinalizeRef.current);
    };
  }, []);

  function beginHoldRoll() {
    if (!canRoll || rollPreviewRef.current !== null) return;
    setPreviewDice(randomDice(game.kept, game.dice));
    setIsRollingAnim(true);
    rollPreviewRef.current = window.setInterval(() => {
      setPreviewDice(randomDice(game.kept, game.dice));
    }, 45);
  }

  function endHoldRoll() {
    if (rollPreviewRef.current === null) return;
    window.clearInterval(rollPreviewRef.current);
    rollPreviewRef.current = null;
    setPreviewDice(null);
    setIsRollingAnim(false);
    game.rollDice();
    setIsRollLocked(true);
    if (rollFinalizeRef.current !== null) window.clearTimeout(rollFinalizeRef.current);
    rollFinalizeRef.current = window.setTimeout(() => {
      setIsRollLocked(false);
      rollFinalizeRef.current = null;
    }, ROLL_LOCK_MS);
  }

  function confirmSelectedCategory() {
    game.confirmCategory();
  }

  function resetLocalRollState() {
    if (rollPreviewRef.current !== null) {
      window.clearInterval(rollPreviewRef.current);
      rollPreviewRef.current = null;
    }
    if (rollFinalizeRef.current !== null) {
      window.clearTimeout(rollFinalizeRef.current);
      rollFinalizeRef.current = null;
    }
    setPreviewDice(null);
    setIsRollingAnim(false);
    setIsRollLocked(false);
  }

  return (
    <main className="app-root">
      {!hasStarted && (
        <section className="intro-screen">
          <div className="intro-card">
            {introStep === 'menu' ? (
              <>
                <h1>Yacht Dice</h1>
                <div className="intro-actions">
                  <button className="start-button" onClick={() => { setSelectedMode('bot'); setHasStarted(true); }}>
                    봇과 플레이
                  </button>
                  <button className="start-button alt" onClick={() => { setSelectedMode('online'); setIntroStep('online'); }}>
                    친구와 온라인으로
                  </button>
                </div>
              </>
            ) : (
              <>
                <h1>Online Room</h1>
                <div className="intro-actions">
                  <button className="start-button" onClick={() => setOnlineChoice('create')}>
                    방 코드 생성
                  </button>
                  <button className="start-button alt" onClick={() => setOnlineChoice('join')}>
                    방 코드 입력
                  </button>
                </div>
                {onlineChoice === 'create' && (
                  <div className="online-card">
                    <strong>{generatedRoomCode}</strong>
                    <p>실시간 동기화 연결은 서버 연동이 필요해서 아직 UI만 준비된 상태입니다.</p>
                    <button className="start-button" onClick={() => setHasStarted(true)}>
                      테스트 화면 열기
                    </button>
                  </div>
                )}
                {onlineChoice === 'join' && (
                  <div className="online-card">
                    <input
                      className="room-input"
                      value={roomCodeInput}
                      onChange={(event) => setRoomCodeInput(event.target.value.toUpperCase())}
                      placeholder="ROOM CODE"
                    />
                    <p>방 코드 흐름 UI는 준비했지만 실제 친구 연결은 별도 서버 작업이 필요합니다.</p>
                    <button className="start-button" onClick={() => setHasStarted(true)} disabled={!roomCodeInput.trim()}>
                      코드로 입장
                    </button>
                  </div>
                )}
                <button className="back-link" onClick={() => { setIntroStep('menu'); setOnlineChoice('idle'); }}>
                  뒤로
                </button>
              </>
            )}
          </div>
        </section>
      )}

      <section className="board-shell">
        <header className="top-strip table-top">
          <article className={`score-tile ${game.currentPlayer === 0 ? 'active' : ''}`}>
            {emojiBursts.filter((burst) => burst.playerIndex === 0).map((burst, index) => (
              <span key={burst.id} className="score-emoji score-emoji-right" style={{ '--burst-index': index } as CSSProperties}>{burst.emoji}</span>
            ))}
            <span className="tile-label">{game.players[0].name}</span>
            <strong>{game.players[0].totalScore}</strong>
          </article>
          <div className="title-block">
            <strong>Yacht Dice</strong>
            <span>Round {roundNow}/{totalRounds}</span>
          </div>
          <article className={`score-tile ${game.currentPlayer === 1 ? 'active' : ''}`}>
            {emojiBursts.filter((burst) => burst.playerIndex === 1).map((burst, index) => (
              <span key={burst.id} className="score-emoji score-emoji-left" style={{ '--burst-index': index } as CSSProperties}>{burst.emoji}</span>
            ))}
            <span className="tile-label">{game.players[1].name}</span>
            <strong>{game.players[1].totalScore}</strong>
          </article>
          <div className="menu-wrap">
            <button className="menu-button" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen}>
              Menu
            </button>
            {menuOpen && (
              <div className="menu-popover">
                <button className="menu-item" onClick={() => { setMenuOpen(false); setEmojiBursts([]); resetLocalRollState(); game.resetGame(); }}>
                  New Match
                </button>
              </div>
            )}
          </div>
        </header>

        <section className="board-main">
          <section className="table-layout">
            <Scorecard
              dice={shownDice}
              rolled={game.rolled}
              currentPlayer={game.currentPlayer}
              players={game.players}
              selectedCategory={game.pendingCategory}
              onSelect={game.setPendingCategory}
            />

            <section className="dice-stage compact">
              <DiceRack
                dice={shownDice}
                kept={game.kept}
                canKeep={game.rolled && game.rollsLeft < 3 && game.currentPlayer === 0 && !isOver}
                rolling={isRollingAnim}
                onToggle={game.toggleKeep}
              />

              <div className="action-row compact">
                <button
                  className="roll-vertical"
                  disabled={!canRoll}
                  onPointerDown={beginHoldRoll}
                  onPointerUp={endHoldRoll}
                  onPointerCancel={endHoldRoll}
                  onPointerLeave={endHoldRoll}
                >
                  <span className={game.rollsLeft === 3 && !isOver ? 'bouncing' : ''}>Roll</span>
                </button>
                <button
                  className="confirm-score"
                  disabled={game.pendingCategory === null || !game.rolled || game.currentPlayer !== 0 || isOver}
                  onClick={confirmSelectedCategory}
                >
                  Confirm Score
                </button>
              </div>
            </section>

            <section className="taunt-area">
              <EmojiTauntBar disabled={isOver} onSend={sendPlayerTaunt} />
            </section>
          </section>
        </section>

        {isOver && <div className="final-banner">{winnerLabel}</div>}
      </section>
    </main>
  );
}
