import { useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { api } from '../lib/api';
import type { CategoryId } from '../types';

type Account = {
  id: string;
  name: string;
  points: number;
  wins: number;
  losses: number;
  draws: number;
  games: number;
  ownedSkins: string[];
  selectedSkin: string;
};

type Skin = { id: string; name: string; price: number };
type RoomState = {
  roomCode: string;
  players: { accountId: string; connected: boolean; profile: Account }[];
  game: {
    totalRounds: number;
    players: [{ id: string; name: string; scores: Record<string, number>; totalScore: number }, { id: string; name: string; scores: Record<string, number>; totalScore: number }];
    currentPlayer: 0 | 1;
    dice: [number, number, number, number, number];
    kept: [boolean, boolean, boolean, boolean, boolean];
    pendingCategory: string | null;
    rollsLeft: number;
    rolled: boolean;
    round: number;
    turnEndsAt: number | null;
    isOver: boolean;
    winner: 0 | 1 | null;
    isRolling?: boolean;
    rollingPlayer?: 0 | 1 | null;
  };
};

export function useOnlineGame() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [leaderboard, setLeaderboard] = useState<Account[]>([]);
  const [shop, setShop] = useState<Skin[]>([]);
  const [activeAccount, setActiveAccount] = useState<Account | null>(null);
  const [roomCode, setRoomCode] = useState('');
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [error, setError] = useState('');
  const [taunts, setTaunts] = useState<{ id: number; emoji: string; playerIndex: 0 | 1 }[]>([]);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    void refreshLobby();
  }, []);

  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  const myPlayerIndex = useMemo(() => {
    if (!roomState || !activeAccount) return -1;
    return roomState.players.findIndex((p) => p.accountId === activeAccount.id);
  }, [roomState, activeAccount]);

  async function refreshLobby() {
    const [a, l, s] = await Promise.all([api.listAccounts(), api.leaderboard(), api.shop()]);
    setAccounts(a.accounts);
    setLeaderboard(l.leaderboard);
    setShop(s.skins);
    if (activeAccount) {
      const latest = a.accounts.find((x: Account) => x.id === activeAccount.id);
      if (latest) setActiveAccount(latest);
    }
  }

  async function createAccount(name: string) {
    const res = await api.createAccount(name);
    setActiveAccount(res.account);
    await refreshLobby();
  }

  function chooseAccount(id: string) {
    const found = accounts.find((a) => a.id === id);
    if (found) setActiveAccount(found);
  }

  async function purchaseSkin(skinId: string) {
    if (!activeAccount) return;
    const res = await api.purchaseSkin(activeAccount.id, skinId);
    setActiveAccount(res.account);
    await refreshLobby();
  }

  async function selectSkin(skinId: string) {
    if (!activeAccount) return;
    const res = await api.selectSkin(activeAccount.id, skinId);
    setActiveAccount(res.account);
    await refreshLobby();
  }

  function connectToRoom(nextRoomCode: string) {
    if (!activeAccount) {
      setError('Select an account first');
      return;
    }
    setError('');
    const normalized = nextRoomCode.trim().toUpperCase();
    setRoomCode(normalized);
    if (!socketRef.current) {
      socketRef.current = io(api.baseUrl, { transports: ['websocket'] });
      socketRef.current.on('room:state', (state) => setRoomState(state));
      socketRef.current.on('room:error', (payload) => setError(payload.message || 'room error'));
      socketRef.current.on('game:taunt', (payload) => {
        setTaunts((prev) => [...prev, payload]);
        window.setTimeout(() => {
          setTaunts((prev) => prev.filter((x) => x.id !== payload.id));
        }, 1900);
      });
    }
    socketRef.current.emit('lobby:join', { roomCode: normalized, accountId: activeAccount.id });
  }

  function actionRoll() {
    socketRef.current?.emit('game:roll');
  }
  function actionRollStart() {
    socketRef.current?.emit('game:rollStart');
  }
  function actionRollStop() {
    socketRef.current?.emit('game:rollStop');
  }
  function actionToggleKeep(index: number) {
    socketRef.current?.emit('game:toggleKeep', { index });
  }
  function actionSelectCategory(categoryId: CategoryId) {
    socketRef.current?.emit('game:selectCategory', { categoryId });
  }
  function actionConfirmCategory() {
    socketRef.current?.emit('game:confirmCategory');
  }
  function sendTaunt(emoji: string) {
    socketRef.current?.emit('game:taunt', { emoji });
  }

  return {
    accounts,
    leaderboard,
    shop,
    activeAccount,
    roomCode,
    roomState,
    error,
    taunts,
    myPlayerIndex,
    refreshLobby,
    createAccount,
    chooseAccount,
    purchaseSkin,
    selectSkin,
    connectToRoom,
    actionRoll,
    actionRollStart,
    actionRollStop,
    actionToggleKeep,
    actionSelectCategory,
    actionConfirmCategory,
    sendTaunt,
  };
}
