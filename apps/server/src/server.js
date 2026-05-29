import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');
const dbPath = join(dataDir, 'db.json');
const PORT = Number(process.env.PORT || 4000);
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const TURN_SECONDS = 30;
const RECONNECT_GRACE_MS = 90_000;

if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
if (!existsSync(dbPath)) {
  writeFileSync(dbPath, JSON.stringify({ accounts: {}, skins: defaultSkins(), matches: [] }, null, 2));
}

const db = JSON.parse(readFileSync(dbPath, 'utf-8'));
const rooms = new Map();

const app = express();
app.use(cors({ origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN }));
app.use(express.json());

app.get('/health', (_, res) => res.json({ ok: true }));
app.get('/shop', (_, res) => res.json({ skins: Object.values(db.skins) }));
app.get('/accounts', (_, res) => {
  res.json({ accounts: Object.values(db.accounts) });
});
app.post('/accounts', (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'name required' });
  const dup = Object.values(db.accounts).find((a) => a.name.toLowerCase() === name.toLowerCase());
  if (dup) return res.status(409).json({ error: 'name already exists' });
  const id = cryptoId();
  const account = {
    id,
    name,
    points: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    games: 0,
    ownedSkins: ['classic'],
    selectedSkin: 'classic',
  };
  db.accounts[id] = account;
  persist();
  res.json({ account });
});
app.post('/accounts/:id/select-skin', (req, res) => {
  const account = db.accounts[req.params.id];
  if (!account) return res.status(404).json({ error: 'account not found' });
  const skinId = String(req.body?.skinId || '');
  if (!account.ownedSkins.includes(skinId)) return res.status(400).json({ error: 'skin not owned' });
  account.selectedSkin = skinId;
  persist();
  res.json({ account });
});
app.post('/accounts/:id/purchase', (req, res) => {
  const account = db.accounts[req.params.id];
  if (!account) return res.status(404).json({ error: 'account not found' });
  const skinId = String(req.body?.skinId || '');
  const skin = db.skins[skinId];
  if (!skin) return res.status(404).json({ error: 'skin not found' });
  if (account.ownedSkins.includes(skinId)) return res.status(400).json({ error: 'already owned' });
  if (account.points < skin.price) return res.status(400).json({ error: 'not enough points' });
  account.points -= skin.price;
  account.ownedSkins.push(skinId);
  persist();
  res.json({ account });
});
app.get('/leaderboard', (_, res) => {
  const leaderboard = Object.values(db.accounts)
    .sort((a, b) => b.points - a.points || b.wins - a.wins)
    .slice(0, 30);
  res.json({ leaderboard });
});

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN } });

io.on('connection', (socket) => {
  socket.on('lobby:join', ({ roomCode, accountId }) => {
    const room = String(roomCode || '').toUpperCase().trim();
    const account = db.accounts[accountId];
    if (!room || !account) return socket.emit('room:error', { message: 'invalid room or account' });

    if (!rooms.has(room)) rooms.set(room, createRoom(room));
    const state = rooms.get(room);
    let slot = state.players.find((p) => p.accountId === accountId);
    if (!slot && state.players.length >= 2) return socket.emit('room:error', { message: 'room full' });
    if (!slot) {
      slot = { accountId, socketId: socket.id, connected: true, disconnectedAt: null };
      state.players.push(slot);
    } else {
      slot.socketId = socket.id;
      slot.connected = true;
      slot.disconnectedAt = null;
    }
    socket.join(room);
    socket.data.roomCode = room;
    socket.data.accountId = accountId;

    if (state.players.length === 2 && !state.game) {
      state.game = createGameState(room, state.players.map((p) => db.accounts[p.accountId]));
      startTurnTimer(state);
    }
    emitRoomState(state);
  });

  socket.on('game:roll', () => withTurnPlayer(socket, (state) => {
    if (state.game.rollsLeft <= 0 || state.game.round > state.game.totalRounds) return;
    state.game.isRolling = false;
    state.game.rollingPlayer = null;
    state.game.dice = rollDice(state.game.kept, state.game.dice);
    state.game.rollsLeft -= 1;
    state.game.pendingCategory = null;
    state.game.rolled = true;
    emitRoomState(state);
  }));

  socket.on('game:rollStart', () => withTurnPlayer(socket, (state) => {
    if (state.game.rollsLeft <= 0 || state.game.round > state.game.totalRounds) return;
    if (state.game.isRolling) return;
    state.game.isRolling = true;
    state.game.rollingPlayer = state.game.currentPlayer;
    emitRoomState(state);
  }));

  socket.on('game:rollStop', () => withTurnPlayer(socket, (state) => {
    if (!state.game.isRolling || state.game.rollingPlayer !== state.game.currentPlayer) return;
    if (state.game.rollsLeft <= 0 || state.game.round > state.game.totalRounds) return;
    state.game.isRolling = false;
    state.game.rollingPlayer = null;
    state.game.dice = rollDice(state.game.kept, state.game.dice);
    state.game.rollsLeft -= 1;
    state.game.pendingCategory = null;
    state.game.rolled = true;
    emitRoomState(state);
  }));

  socket.on('game:toggleKeep', ({ index }) => withTurnPlayer(socket, (state) => {
    if (!state.game.rolled || state.game.rollsLeft === 3) return;
    if (index < 0 || index > 4) return;
    state.game.kept[index] = !state.game.kept[index];
    emitRoomState(state);
  }));

  socket.on('game:selectCategory', ({ categoryId }) => withTurnPlayer(socket, (state) => {
    if (!state.game.rolled) return;
    const p = state.game.players[state.game.currentPlayer];
    if (p.scores[categoryId] !== undefined) return;
    state.game.pendingCategory = categoryId;
    emitRoomState(state);
  }));

  socket.on('game:confirmCategory', () => withTurnPlayer(socket, (state) => {
    if (!state.game.rolled || !state.game.pendingCategory) return;
    applyCategoryAndNextTurn(state, state.game.pendingCategory);
    emitRoomState(state);
    if (state.game.isOver) finalizeMatch(state);
  }));

  socket.on('game:taunt', ({ emoji }) => {
    const state = getStateFromSocket(socket);
    if (!state) return;
    const playerIndex = playerIndexByAccount(state, socket.data.accountId);
    if (playerIndex === -1) return;
    io.to(state.roomCode).emit('game:taunt', {
      emoji,
      playerIndex,
      id: Date.now() + Math.random(),
      ...makeTauntFx(playerIndex),
    });
  });

  socket.on('disconnect', () => {
    const state = getStateFromSocket(socket);
    if (!state) return;
    const slot = state.players.find((p) => p.accountId === socket.data.accountId);
    if (slot) {
      slot.connected = false;
      slot.disconnectedAt = Date.now();
      emitRoomState(state);
    }
  });
});

setInterval(() => {
  const now = Date.now();
  for (const state of rooms.values()) {
    if (!state.game || !state.game.turnEndsAt || state.game.isOver) continue;
    if (state.players.some((p) => !p.connected && p.disconnectedAt && now - p.disconnectedAt > RECONNECT_GRACE_MS)) {
      const winnerIndex = state.players.findIndex((p) => p.connected);
      if (winnerIndex >= 0) {
        state.game.isOver = true;
        state.game.winner = winnerIndex;
        emitRoomState(state);
        finalizeMatch(state);
      }
      continue;
    }
    if (now >= state.game.turnEndsAt) {
      autoPlayTimedOutTurn(state);
      emitRoomState(state);
      if (state.game.isOver) finalizeMatch(state);
    }
  }
}, 1000);

httpServer.listen(PORT, () => {
  console.log(`server on ${PORT}`);
});

function createRoom(roomCode) {
  return { roomCode, players: [], game: null };
}

function createGameState(roomCode, accounts) {
  return {
    roomCode,
    totalRounds: 13,
    players: accounts.map((account) => ({
      id: account.id,
      name: account.name,
      scores: {},
      totalScore: 0,
      selectedSkin: account.selectedSkin,
    })),
    currentPlayer: 0,
    dice: [1, 1, 1, 1, 1],
    kept: [false, false, false, false, false],
    pendingCategory: null,
    rollsLeft: 3,
    rolled: false,
    round: 1,
    turnEndsAt: null,
    isOver: false,
    winner: null,
    isRolling: false,
    rollingPlayer: null,
  };
}

function startTurnTimer(state) {
  state.game.turnEndsAt = Date.now() + TURN_SECONDS * 1000;
}

function applyCategoryAndNextTurn(state, categoryId) {
  const g = state.game;
  const p = g.players[g.currentPlayer];
  if (p.scores[categoryId] !== undefined) return;
  p.scores[categoryId] = calcScore(categoryId, g.dice);
  p.totalScore = calcTotal(p.scores);

  const nextCurrent = g.currentPlayer === 0 ? 1 : 0;
  const finishedPair = g.currentPlayer === 1;
  g.currentPlayer = nextCurrent;
  g.round = finishedPair ? g.round + 1 : g.round;
  g.dice = [1, 1, 1, 1, 1];
  g.kept = [false, false, false, false, false];
  g.pendingCategory = null;
  g.rollsLeft = 3;
  g.rolled = false;
  g.isRolling = false;
  g.rollingPlayer = null;
  g.turnEndsAt = Date.now() + TURN_SECONDS * 1000;
  if (g.round > g.totalRounds) {
    g.isOver = true;
    if (g.players[0].totalScore === g.players[1].totalScore) g.winner = null;
    else g.winner = g.players[0].totalScore > g.players[1].totalScore ? 0 : 1;
  }
}

function autoPlayTimedOutTurn(state) {
  const g = state.game;
  g.isRolling = false;
  g.rollingPlayer = null;
  if (!g.rolled) {
    g.dice = rollDice([false, false, false, false, false], g.dice);
    g.rolled = true;
    g.rollsLeft = Math.max(g.rollsLeft - 1, 0);
  }
  const open = categories().filter((id) => g.players[g.currentPlayer].scores[id] === undefined);
  let best = open[0];
  let bestScore = -Infinity;
  for (const id of open) {
    const v = calcScore(id, g.dice);
    if (v > bestScore) {
      bestScore = v;
      best = id;
    }
  }
  applyCategoryAndNextTurn(state, best);
}

function emitRoomState(state) {
  io.to(state.roomCode).emit('room:state', {
    roomCode: state.roomCode,
    players: state.players.map((p) => ({
      accountId: p.accountId,
      connected: p.connected,
      profile: db.accounts[p.accountId],
    })),
    game: state.game,
    reconnectGraceMs: RECONNECT_GRACE_MS,
  });
}

function withTurnPlayer(socket, fn) {
  const state = getStateFromSocket(socket);
  if (!state || !state.game || state.game.isOver) return;
  const playerIndex = playerIndexByAccount(state, socket.data.accountId);
  if (playerIndex !== state.game.currentPlayer) return;
  fn(state, playerIndex);
}

function getStateFromSocket(socket) {
  const roomCode = socket.data.roomCode;
  if (!roomCode || !rooms.has(roomCode)) return null;
  return rooms.get(roomCode);
}

function playerIndexByAccount(state, accountId) {
  return state.players.findIndex((p) => p.accountId === accountId);
}

function finalizeMatch(state) {
  if (!state.game || !state.game.isOver || state.matchSaved) return;
  const g = state.game;
  const [a, b] = state.players.map((p) => db.accounts[p.accountId]);
  a.games += 1;
  b.games += 1;
  if (g.winner === null) {
    a.draws += 1;
    b.draws += 1;
    a.points += 20;
    b.points += 20;
  } else if (g.winner === 0) {
    a.wins += 1;
    b.losses += 1;
    a.points += 30;
    b.points += 10;
  } else {
    b.wins += 1;
    a.losses += 1;
    b.points += 30;
    a.points += 10;
  }
  db.matches.push({
    id: cryptoId(),
    roomCode: state.roomCode,
    createdAt: new Date().toISOString(),
    winner: g.winner,
    scores: [g.players[0].totalScore, g.players[1].totalScore],
    players: [a.id, b.id],
  });
  state.matchSaved = true;
  persist();
  emitRoomState(state);
}

function persist() {
  writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

function rollDice(kept, prev) {
  return prev.map((v, i) => (kept[i] ? v : Math.floor(Math.random() * 6) + 1));
}

function categories() {
  return ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes', '3oak', '4oak', 'fh', 'ss', 'ls', 'yacht', 'choice'];
}

function calcScore(categoryId, dice) {
  const counts = [0, 0, 0, 0, 0, 0];
  for (const d of dice) counts[d - 1] += 1;
  const sum = dice.reduce((a, b) => a + b, 0);
  if (categoryId === 'ones') return counts[0];
  if (categoryId === 'twos') return counts[1] * 2;
  if (categoryId === 'threes') return counts[2] * 3;
  if (categoryId === 'fours') return counts[3] * 4;
  if (categoryId === 'fives') return counts[4] * 5;
  if (categoryId === 'sixes') return counts[5] * 6;
  if (categoryId === '3oak') return counts.some((c) => c >= 3) ? sum : 0;
  if (categoryId === '4oak') return counts.some((c) => c >= 4) ? sum : 0;
  if (categoryId === 'choice') return sum;
  if (categoryId === 'fh') return counts.some((c) => c === 3) && counts.some((c) => c === 2) ? sum : 0;
  if (categoryId === 'ss') {
    const s = new Set(dice);
    return ([1, 2, 3, 4].every((n) => s.has(n)) || [2, 3, 4, 5].every((n) => s.has(n)) || [3, 4, 5, 6].every((n) => s.has(n))) ? 15 : 0;
  }
  if (categoryId === 'ls') {
    const s = new Set(dice);
    return ([1, 2, 3, 4, 5].every((n) => s.has(n)) || [2, 3, 4, 5, 6].every((n) => s.has(n))) ? 30 : 0;
  }
  if (categoryId === 'yacht') return dice.every((d) => d === dice[0]) ? 50 : 0;
  return 0;
}

function calcUpperBonus(scores) {
  const upper = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];
  const total = upper.reduce((sum, id) => sum + (scores[id] ?? 0), 0);
  return total >= 63 ? 35 : 0;
}

function calcTotal(scores) {
  return Object.values(scores).reduce((a, b) => a + (b ?? 0), 0) + calcUpperBonus(scores);
}

function defaultSkins() {
  return {
    classic: { id: 'classic', name: 'Classic', price: 0 },
    fire: { id: 'fire', name: 'Fire', price: 120 },
    stars: { id: 'stars', name: 'Stars', price: 150 },
    fruits: { id: 'fruits', name: 'Fruits', price: 180 },
    space: { id: 'space', name: 'Space', price: 220 },
    gem: { id: 'gem', name: 'Gem', price: 260 },
  };
}

function cryptoId() {
  return Math.random().toString(36).slice(2, 10);
}

function makeTauntFx(playerIndex) {
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

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
