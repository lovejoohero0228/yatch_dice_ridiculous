import type { CSSProperties } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DiceRack } from './components/game/DiceRack';
import { EmojiTauntBar } from './components/game/EmojiTauntBar';
import { Scorecard } from './components/game/Scorecard';
import { useBotAI } from './hooks/useBotAI';
import { useOnlineGame } from './hooks/useOnlineGame';
import { useYachtGame } from './hooks/useYachtGame';
import type { CategoryId, GameMode } from './types';

type IntroStep =
  | 'account-choice'
  | 'account-create'
  | 'account-select'
  | 'mode-select'
  | 'friend-mode-select'
  | 'online-menu'
  | 'room-wait'
  | 'room-join';

type Scene = 'intro' | 'online-game' | 'local-game';

function makeRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function randomDice(kept: boolean[], baseDice: [number, number, number, number, number]): [number, number, number, number, number] {
  return baseDice.map((value, index) => (kept[index] ? value : Math.floor(Math.random() * 6) + 1)) as [number, number, number, number, number];
}

export default function App() {
  const online = useOnlineGame();
  const [boardScale, setBoardScale] = useState(1);
  const [scene, setScene] = useState<Scene>('intro');
  const [step, setStep] = useState<IntroStep>('account-choice');
  const [newName, setNewName] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [inputRoomCode, setInputRoomCode] = useState('');
  const [createdRoomCode, setCreatedRoomCode] = useState('');
  const [message, setMessage] = useState('');
  const [localMode, setLocalMode] = useState<GameMode>('bot');
  const [localTaunts, setLocalTaunts] = useState<Array<{ id: number; emoji: string; playerIndex: 0 | 1; x: number; y: number; size: number; rotate: number }>>([]);
  const [localRolling, setLocalRolling] = useState(false);
  const [previewDice, setPreviewDice] = useState<[number, number, number, number, number] | null>(null);
  const holdingRollRef = useRef(false);
  const generatedRoom = useMemo(() => makeRoomCode(), []);

  const activeAccount = online.activeAccount;
  const localGame = useYachtGame(localMode, {
    playerOneName: activeAccount?.name ?? 'Player 1',
    playerTwoName: localMode === 'bot' ? 'Bot' : 'Player 2',
  });
  useBotAI(localGame);

  const onlineGame = online.roomState?.game ?? null;
  const game = scene === 'online-game' ? onlineGame : scene === 'local-game' ? localGame : null;
  const players = game?.players ?? [];
  const isOnline = scene === 'online-game';
  const onlineRolling = Boolean(isOnline && onlineGame?.isRolling);
  const rolling = isOnline ? onlineRolling : localRolling;
  const myTurn = isOnline ? Boolean(game && online.myPlayerIndex === game.currentPlayer) : Boolean(game && game.currentPlayer === 0);
  const canKeep = Boolean(game && myTurn && game.rolled && game.rollsLeft < 3 && !isGameOver(game) && !rolling);
  const canRoll = Boolean(game && myTurn && game.rollsLeft > 0 && !isGameOver(game));
  const shownDice = previewDice ?? game?.dice ?? [1, 1, 1, 1, 1];
  const timer = isOnline && onlineGame?.turnEndsAt ? Math.max(0, Math.ceil((onlineGame.turnEndsAt - Date.now()) / 1000)) : null;
  const scorePlayers = (players.length === 2
    ? players
    : [{ name: 'P1', totalScore: 0, scores: {} }, { name: 'P2', totalScore: 0, scores: {} }]) as [
    { name: string; totalScore: number; scores: Partial<Record<CategoryId, number>> },
    { name: string; totalScore: number; scores: Partial<Record<CategoryId, number>> },
  ];
  const winner = isOnline ? onlineGame?.winner ?? null : localGame.winner;
  const isOver = game ? isGameOver(game) : false;
  const taunts = isOnline ? online.taunts : localTaunts;

  useEffect(() => {
    if (scene === 'online-game' && onlineGame) setMessage('');
  }, [scene, onlineGame]);

  useEffect(() => {
    const updateScale = () => {
      if (window.innerWidth > 720) {
        setBoardScale(1);
        return;
      }
      const baseWidth = 820;
      const baseHeight = 1180;
      const vw = window.visualViewport?.width ?? window.innerWidth;
      const vh = window.visualViewport?.height ?? window.innerHeight;
      const widthScale = (vw - 12) / baseWidth;
      const heightScale = (vh - 16) / baseHeight;
      const next = Math.min(1, widthScale, heightScale);
      setBoardScale(Math.max(0.35, next));
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    window.visualViewport?.addEventListener('resize', updateScale);
    return () => {
      window.removeEventListener('resize', updateScale);
      window.visualViewport?.removeEventListener('resize', updateScale);
    };
  }, []);

  useEffect(() => {
    if (scene === 'intro' && (step === 'room-wait' || step === 'room-join') && onlineGame) {
      setScene('online-game');
    }
  }, [scene, step, onlineGame]);

  useEffect(() => {
    if (!game || !rolling) {
      setPreviewDice(null);
      return;
    }
    setPreviewDice(randomDice(game.kept, game.dice));
    const timer = window.setInterval(() => {
      setPreviewDice(randomDice(game.kept, game.dice));
    }, 60);
    return () => window.clearInterval(timer);
  }, [rolling, game?.dice, game?.kept, game]);

  useEffect(() => {
    if (scene !== 'local-game') setLocalRolling(false);
    if (scene === 'intro') holdingRollRef.current = false;
  }, [scene]);

  async function handleCreateAccountContinue() {
    try {
      setMessage('');
      await online.createAccount(newName.trim());
      setSelectedAccountId('');
      setStep('mode-select');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'account create failed');
    }
  }

  function handleSelectAccountContinue() {
    if (!selectedAccountId) return;
    online.chooseAccount(selectedAccountId);
    setMessage('');
    setStep('mode-select');
  }

  function beginHoldRoll() {
    if (!game || !canRoll || holdingRollRef.current) return;
    holdingRollRef.current = true;
    if (isOnline) online.actionRollStart();
    else setLocalRolling(true);
  }

  function endHoldRoll() {
    if (!holdingRollRef.current || !game) return;
    holdingRollRef.current = false;
    if (isOnline) online.actionRollStop();
    else {
      setLocalRolling(false);
      localGame.rollDice();
    }
  }

  function onSelectCategory(categoryId: CategoryId) {
    if (isOnline) online.actionSelectCategory(categoryId);
    else localGame.setPendingCategory(categoryId);
  }

  function onConfirmCategory() {
    if (isOnline) online.actionConfirmCategory();
    else localGame.confirmCategory();
  }

  function onToggleKeep(index: number) {
    if (isOnline) online.actionToggleKeep(index);
    else localGame.toggleKeep(index);
  }

  function onSendTaunt(emoji: string) {
    if (isOnline) {
      online.sendTaunt(emoji);
      return;
    }
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const playerIndex = (localGame.currentPlayer === 0 ? 0 : 1) as 0 | 1;
    setLocalTaunts((prev) => [...prev, { id, emoji, playerIndex, ...makeTauntFx(playerIndex) }]);
    window.setTimeout(() => setLocalTaunts((prev) => prev.filter((t) => t.id !== id)), 1900);
  }

  return (
    <main className="app-root">
      {scene === 'intro' && (
        <section className="intro-screen">
          <div className="intro-card">
            <h1>Yacht Dice</h1>
            {step === 'account-choice' && (
              <div className="intro-actions">
                <button className="start-button" onClick={() => setStep('account-create')}>계정 생성하기</button>
                <button className="start-button" onClick={() => setStep('account-select')}>기존 계정 사용하기</button>
              </div>
            )}
            {step === 'account-create' && (
              <>
                <div className="online-card">
                  <input className="room-input" placeholder="닉네임" value={newName} onChange={(e) => setNewName(e.target.value)} />
                  <button className="start-button" disabled={!newName.trim()} onClick={() => void handleCreateAccountContinue()}>Continue</button>
                </div>
                <button className="back-link" onClick={() => setStep('account-choice')}>뒤로</button>
              </>
            )}
            {step === 'account-select' && (
              <>
                <div className="online-card">
                  <div className="intro-actions">
                    {online.accounts.map((a) => (
                      <button
                        key={a.id}
                        className={`start-button ${selectedAccountId === a.id ? 'selected-button' : ''}`}
                        onClick={() => setSelectedAccountId(a.id)}
                      >
                        {a.name}
                      </button>
                    ))}
                  </div>
                  <button className="start-button" disabled={!selectedAccountId} onClick={handleSelectAccountContinue}>Continue</button>
                </div>
                <button className="back-link" onClick={() => setStep('account-choice')}>뒤로</button>
              </>
            )}
            {step === 'mode-select' && (
              <>
                <div className="online-card">
                  <p>{activeAccount ? `${activeAccount.name} 계정 선택됨` : '계정을 먼저 선택하세요'}</p>
                  <div className="intro-actions">
                    <button className="start-button" onClick={() => { setLocalMode('bot'); localGame.resetGame(); setScene('local-game'); }}>봇과 플레이</button>
                    <button className="start-button" onClick={() => setStep('friend-mode-select')}>친구와 플레이</button>
                  </div>
                </div>
                <button className="back-link" onClick={() => setStep('account-choice')}>처음으로</button>
              </>
            )}
            {step === 'friend-mode-select' && (
              <>
                <div className="online-card">
                  <div className="intro-actions">
                    <button className="start-button" onClick={() => setStep('online-menu')}>온라인 대전</button>
                    <button className="start-button" onClick={() => { setLocalMode('local'); localGame.resetGame(); setScene('local-game'); }}>오프라인 대전</button>
                  </div>
                </div>
                <button className="back-link" onClick={() => setStep('mode-select')}>뒤로</button>
              </>
            )}
            {step === 'online-menu' && (
              <>
                <div className="online-card">
                  <div className="intro-actions">
                    <button
                      className="start-button"
                      onClick={() => {
                        setCreatedRoomCode(generatedRoom);
                        online.connectToRoom(generatedRoom);
                        setStep('room-wait');
                      }}
                    >
                      방 생성
                    </button>
                    <button className="start-button" onClick={() => setStep('room-join')}>방 참여</button>
                  </div>
                </div>
                <button className="back-link" onClick={() => setStep('friend-mode-select')}>뒤로</button>
              </>
            )}
            {step === 'room-wait' && (
              <>
                <div className="online-card">
                  <strong>{createdRoomCode}</strong>
                  <p>상대가 입장하면 자동으로 시작됩니다.</p>
                </div>
                <button className="back-link" onClick={() => setStep('online-menu')}>뒤로</button>
              </>
            )}
            {step === 'room-join' && (
              <>
                <div className="online-card">
                  <input className="room-input" placeholder="ROOM CODE" value={inputRoomCode} onChange={(e) => setInputRoomCode(e.target.value.toUpperCase())} />
                  <button
                    className="start-button"
                    disabled={!inputRoomCode.trim()}
                    onClick={() => {
                      online.connectToRoom(inputRoomCode);
                      setStep('room-wait');
                    }}
                  >
                    입장
                  </button>
                </div>
                <button className="back-link" onClick={() => setStep('online-menu')}>뒤로</button>
              </>
            )}
            {(message || online.error) && <p>{message || online.error}</p>}
          </div>
        </section>
      )}

      {scene === 'online-game' && !game && (
        <section className="intro-screen">
          <div className="intro-card">
            <h1>Yacht Dice</h1>
            <div className="online-card">
              <strong>{online.roomCode || createdRoomCode || inputRoomCode || 'ROOM'}</strong>
              <p>Waiting for players...</p>
            </div>
            <button className="start-button" onClick={() => { setScene('intro'); setStep('online-menu'); }}>
              Back
            </button>
          </div>
        </section>
      )}

      {scene !== 'intro' && game && (
        <section className="board-viewport">
          <div className="board-canvas" style={{ '--board-scale': boardScale } as CSSProperties}>
          <section className="board-shell scaled" style={{ '--board-scale': boardScale } as CSSProperties}>
          <header className="top-strip table-top">
            <article className={`score-tile ${game.currentPlayer === 0 ? 'active' : ''}`}>
              <span className="tile-label">{players[0]?.name ?? 'P1'}</span>
              <strong>{players[0]?.totalScore ?? 0}</strong>
            </article>
            <div className="title-block">
              <strong>{isOnline ? `Room ${online.roomCode}` : (localMode === 'bot' ? 'Bot Match' : 'Offline Match')}</strong>
              <span>Round {game.round}/13 {timer !== null ? `| Turn ${timer}s` : ''}</span>
            </div>
            <article className={`score-tile ${game.currentPlayer === 1 ? 'active' : ''}`}>
              <span className="tile-label">{players[1]?.name ?? 'P2'}</span>
              <strong>{players[1]?.totalScore ?? 0}</strong>
            </article>
          </header>
          <div className="taunt-overlay-layer" aria-hidden="true">
            {taunts.map((t) => (
              <span
                key={t.id}
                className="score-emoji score-emoji-floating"
                style={
                  {
                    '--taunt-left': `${t.x}%`,
                    '--taunt-top': `${t.y}%`,
                    '--taunt-size': `${t.size}px`,
                    '--taunt-rotate': `${t.rotate}deg`,
                  } as CSSProperties
                }
              >
                {t.emoji}
              </span>
            ))}
          </div>
          <section className="board-main">
            <section className="table-layout">
              <Scorecard
                dice={shownDice}
                rolled={game.rolled}
                currentPlayer={game.currentPlayer}
                players={scorePlayers}
                selectedCategory={game.pendingCategory as CategoryId | null}
                onSelect={onSelectCategory}
              />
              <section className="dice-stage compact">
                <DiceRack dice={shownDice} kept={game.kept} canKeep={canKeep} rolling={rolling} onToggle={onToggleKeep} />
                <div className="action-row compact">
                  <button
                    className="roll-vertical"
                    disabled={!canRoll}
                    onPointerDown={beginHoldRoll}
                    onPointerUp={endHoldRoll}
                    onPointerCancel={endHoldRoll}
                    onPointerLeave={endHoldRoll}
                  >
                    Roll
                  </button>
                  <button className="confirm-score" disabled={!myTurn || !game.pendingCategory || !game.rolled || isOver} onClick={onConfirmCategory}>
                    Confirm Score
                  </button>
                </div>
              </section>
              <section className="taunt-area">
                <EmojiTauntBar disabled={isOver} onSend={onSendTaunt} />
              </section>
            </section>
          </section>
          <div className="action-row compact">
            <button className="start-button" onClick={() => { setScene('intro'); setStep('mode-select'); setMessage(''); }}>로비로 돌아가기</button>
          </div>
          {isOver && (
            <div className="final-banner">
              {winner === null ? 'DRAW' : `${players[winner]?.name} WINS`}
            </div>
          )}
        </section>
        </div>
        </section>
      )}
    </main>
  );
}

function isGameOver(game: { round: number; isOver?: boolean }) {
  return typeof game.isOver === 'boolean' ? game.isOver : game.round > 13;
}

function makeTauntFx(playerIndex: 0 | 1) {
  const isLeft = playerIndex === 0;
  const xMin = isLeft ? 5 : 53;
  const xMax = isLeft ? 47 : 95;
  return {
    x: randInt(xMin, xMax),
    y: randInt(8, 88),
    size: randInt(88, 160),
    rotate: randInt(-18, 18),
  };
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
