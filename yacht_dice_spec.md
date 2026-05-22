# 🎲 Yacht Dice — 프로젝트 스펙 & 구현 가이드

## 프로젝트 개요

모바일 우선 웹 기반 야트 다이스 게임. Android/iOS 브라우저에서 모두 동작하는 PWA.  
실시간 멀티플레이, 봇 대전, 코인 경제, 이모티콘 조롱 시스템이 핵심.

---

## 기술 스택

| 레이어 | 선택 |
|---|---|
| 프론트엔드 | React + TypeScript + Vite |
| 스타일 | Tailwind CSS v4 |
| 상태관리 | Zustand |
| 실시간 통신 | Socket.IO (WebSocket) |
| 백엔드 | Node.js + Express + Socket.IO |
| DB | PostgreSQL (유저/코인/스킨) + Redis (게임 세션) |
| 인증 | 게스트 UUID 자동 발급 → 선택적 닉네임 등록 |
| 배포 | Vercel (프론트) + Railway 또는 Fly.io (백엔드) |
| PWA | vite-plugin-pwa (오프라인 캐시, 홈 화면 추가) |

---

## 디렉토리 구조

```
yacht-dice/
├── apps/
│   ├── web/                        # React 프론트엔드
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── game/
│   │   │   │   │   ├── DiceRack.tsx        # 주사위 5개 렌더링 + 굴리기 애니메이션
│   │   │   │   │   ├── Scorecard.tsx       # 점수판 (내 점수 / 상대 점수)
│   │   │   │   │   ├── PlayerCard.tsx      # 플레이어 정보 + 현재 총점
│   │   │   │   │   ├── EmojiTauntBar.tsx   # 이모티콘 조롱 슬라이더
│   │   │   │   │   └── OpponentEmojiOverlay.tsx  # 상대 이모티콘 팝업
│   │   │   │   ├── lobby/
│   │   │   │   │   ├── HomeScreen.tsx
│   │   │   │   │   ├── Matchmaking.tsx     # 가짜 매칭 → 봇 연결
│   │   │   │   │   ├── FriendLobby.tsx     # 방 코드 생성/입장
│   │   │   │   │   └── LocalLobby.tsx
│   │   │   │   ├── shop/
│   │   │   │   │   ├── ShopScreen.tsx
│   │   │   │   │   └── ShopItem.tsx
│   │   │   │   └── result/
│   │   │   │       └── ResultScreen.tsx
│   │   │   ├── store/
│   │   │   │   ├── gameStore.ts            # 게임 진행 상태 (Zustand)
│   │   │   │   ├── userStore.ts            # 유저 정보, 코인, 스킨
│   │   │   │   └── socketStore.ts          # 소켓 연결 상태
│   │   │   ├── hooks/
│   │   │   │   ├── useYachtGame.ts         # 게임 로직 훅
│   │   │   │   ├── useSocket.ts            # 소켓 이벤트 훅
│   │   │   │   └── useBotAI.ts             # 봇 AI 로직 훅
│   │   │   ├── lib/
│   │   │   │   ├── yacht.ts                # 야트 점수 계산 순수 함수
│   │   │   │   ├── botAI.ts                # 봇 전략 로직
│   │   │   │   └── skins.ts                # 스킨 정의 및 주사위 페이스
│   │   │   ├── types/
│   │   │   │   └── index.ts                # 공용 타입 정의
│   │   │   └── App.tsx
│   └── server/                     # Node.js 백엔드
│       ├── src/
│       │   ├── rooms/
│       │   │   ├── roomManager.ts          # 방 생성/삭제/매칭 관리
│       │   │   └── gameSession.ts          # 게임 상태 서버 사이드 관리
│       │   ├── socket/
│       │   │   └── handlers.ts             # 소켓 이벤트 핸들러
│       │   ├── db/
│       │   │   ├── schema.sql
│       │   │   └── queries.ts
│       │   └── index.ts
├── package.json                    # 모노레포 루트 (pnpm workspaces)
└── pnpm-workspace.yaml
```

---

## 핵심 타입 정의 (`types/index.ts`)

```typescript
export type GameMode = 'bot' | 'local' | 'online';

export type CategoryId =
  | 'ones' | 'twos' | 'threes' | 'fours' | 'fives' | 'sixes'
  | 'choice' | '4oak' | 'fh' | 'ss' | 'ls' | 'yacht';

export type SkinId = 'classic' | 'fire' | 'stars' | 'fruits' | 'space' | 'gem';

export interface Player {
  id: string;
  name: string;
  avatar: string;
  isBot: boolean;
  scores: Partial<Record<CategoryId, number>>;
  totalScore: number;
}

export interface GameState {
  mode: GameMode;
  players: [Player, Player];
  currentPlayer: 0 | 1;
  dice: [number, number, number, number, number];
  kept: [boolean, boolean, boolean, boolean, boolean];
  rollsLeft: number;           // 0~3, 라운드 시작 시 3으로 리셋
  rolled: boolean;             // 이번 라운드 한 번이라도 굴렸는지
  round: number;               // 1~12
}

export interface Skin {
  id: SkinId;
  name: string;
  preview: string;
  price: number;
  faces: [string, string, string, string, string, string];  // 1~6 페이스
}

// 소켓 이벤트 페이로드
export interface SocketEvents {
  // 클라이언트 → 서버
  'room:create': { playerName: string };
  'room:join': { code: string; playerName: string };
  'game:roll': { kept: boolean[] };
  'game:score': { categoryId: CategoryId };
  'game:taunt': { emoji: string };

  // 서버 → 클라이언트
  'room:created': { code: string };
  'room:ready': { players: Player[] };
  'game:state': { state: GameState };
  'game:taunt:received': { emoji: string; from: string };
  'game:end': { winner: 0 | 1 | null; coinsEarned: number };
}
```

---

## 야트 게임 로직 (`lib/yacht.ts`)

```typescript
export function calcScore(categoryId: CategoryId, dice: number[]): number {
  const counts = Array(6).fill(0);
  dice.forEach(d => counts[d - 1]++);
  const sum = dice.reduce((a, b) => a + b, 0);

  switch (categoryId) {
    case 'ones':   return counts[0] * 1;
    case 'twos':   return counts[1] * 2;
    case 'threes': return counts[2] * 3;
    case 'fours':  return counts[3] * 4;
    case 'fives':  return counts[4] * 5;
    case 'sixes':  return counts[5] * 6;
    case 'choice': return sum;
    case '4oak':   return counts.some(c => c >= 4) ? sum : 0;
    case 'fh': {
      const has3 = counts.some(c => c === 3);
      const has2 = counts.some(c => c === 2);
      return has3 && has2 ? sum : 0;
    }
    case 'ss': {
      const s = new Set(dice);
      const runs = [[1,2,3,4],[2,3,4,5],[3,4,5,6]];
      return runs.some(r => r.every(n => s.has(n))) ? 15 : 0;
    }
    case 'ls': {
      const s = new Set(dice);
      const valid = [1,2,3,4,5].every(n => s.has(n)) || [2,3,4,5,6].every(n => s.has(n));
      return valid ? 30 : 0;
    }
    case 'yacht': return dice.every(d => d === dice[0]) ? 50 : 0;
    default: return 0;
  }
}

export function calcUpperBonus(scores: Partial<Record<CategoryId, number>>): number {
  const upper: CategoryId[] = ['ones','twos','threes','fours','fives','sixes'];
  const total = upper.reduce((sum, id) => sum + (scores[id] ?? 0), 0);
  return total >= 63 ? 35 : 0;
}

export function calcTotal(scores: Partial<Record<CategoryId, number>>): number {
  return Object.values(scores).reduce((a, b) => a + b, 0) + calcUpperBonus(scores);
}
```

---

## 봇 AI 전략 (`lib/botAI.ts`)

봇은 3단계 우선순위로 동작:

```typescript
// 1순위: 야트 / 큰 스트레이트 완성 가능하면 그쪽으로 올인
// 2순위: 4개 이상 같은 숫자 → 포카인드 또는 풀하우스 狙
// 3순위: 남은 카테고리 중 기대값이 가장 높은 항목 선택

export function botDecideKeep(dice: number[], remainingCategories: CategoryId[]): boolean[] {
  const counts = Array(6).fill(0);
  dice.forEach(d => counts[d - 1]++);
  const maxCount = Math.max(...counts);
  const bestVal = counts.indexOf(maxCount) + 1;

  // 야트 가능성 체크
  if (maxCount >= 4) return dice.map(d => d === bestVal);

  // 스트레이트 가능성 체크
  const s = new Set(dice);
  if (s.size >= 4) return dice.map((d, i) => {
    const without = dice.filter((_, j) => j !== i);
    return new Set(without).size >= 4;
  });

  // 기본: 가장 많은 숫자 유지 + 5 이상은 유지
  return dice.map(d => d === bestVal || d >= 5);
}

export function botChooseCategory(
  dice: number[],
  available: CategoryId[]
): CategoryId {
  let best = available[0];
  let bestScore = -1;
  for (const cat of available) {
    const score = calcScore(cat, dice);
    if (score > bestScore) { bestScore = score; best = cat; }
  }
  return best;
}

// 봇 딜레이 설정 (ms) — 사람처럼 보이게
export const BOT_THINK_DELAY = { min: 800, max: 2000 };
export const BOT_ROLL_DELAY  = { min: 600, max: 1200 };
```

---

## 스킨 정의 (`lib/skins.ts`)

```typescript
export const SKINS: Record<SkinId, Skin> = {
  classic: { id:'classic', name:'클래식',  preview:'⚀⚁⚂', price:0,   faces:['⚀','⚁','⚂','⚃','⚄','⚅'] },
  fire:    { id:'fire',    name:'파이어',  preview:'🔥',    price:150, faces:['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣'] },
  stars:   { id:'stars',   name:'스타',    preview:'⭐',    price:200, faces:['🌑','🌒','🌓','🌔','🌕','🌟'] },
  fruits:  { id:'fruits',  name:'과일',    preview:'🍎',    price:180, faces:['🍎','🍊','🍋','🍇','🍒','🍓'] },
  space:   { id:'space',   name:'우주',    preview:'🚀',    price:300, faces:['🌍','🪐','⭐','☄️','🌌','🚀'] },
  gem:     { id:'gem',     name:'보석',    preview:'💎',    price:250, faces:['💎','💍','👑','🔮','🪩','✨'] },
};
```

---

## 이모티콘 조롱 시스템

```typescript
export const TAUNTS = [
  { emoji: '😂', text: 'ㅋㅋㅋ' },
  { emoji: '💩', text: '이게 최선?' },
  { emoji: '🤡', text: '어이없다' },
  { emoji: '😴', text: '졸려 ㅋ' },
  { emoji: '👋', text: '안녕히~' },
  { emoji: '🔥', text: '나는 뜨거워' },
  { emoji: '😈', text: '각이다' },
  { emoji: '🐢', text: '느려터진' },
];

// 소켓 이벤트 흐름
// 클라이언트 A: socket.emit('game:taunt', { emoji: '😂' })
// 서버: 같은 방의 상대방에게만 전달
// 클라이언트 B: socket.on('game:taunt:received', ...) → 화면 중앙에 애니메이션

// 봇 조롱 응답 확률: 20% (랜덤 이모티콘 + 0.5~1.5초 딜레이)
```

---

## 소켓 서버 핵심 로직 (`server/socket/handlers.ts`)

```typescript
// 방 관리
io.on('connection', (socket) => {

  socket.on('room:create', ({ playerName }) => {
    const code = generateRoomCode();          // 6자리 대문자 영숫자
    const room = roomManager.create(code, { id: socket.id, name: playerName });
    socket.join(code);
    socket.emit('room:created', { code });
  });

  socket.on('room:join', ({ code, playerName }) => {
    const room = roomManager.get(code);
    if (!room || room.players.length >= 2) {
      socket.emit('room:error', { message: '방을 찾을 수 없거나 가득 찼습니다.' });
      return;
    }
    roomManager.addPlayer(code, { id: socket.id, name: playerName });
    socket.join(code);
    io.to(code).emit('room:ready', { players: room.players });
    // 게임 시작
    const initialState = createInitialGameState(room.players);
    io.to(code).emit('game:state', { state: initialState });
  });

  socket.on('game:roll', ({ kept }) => {
    // 서버에서 주사위 굴려서 결과 전송 (치트 방지)
    const room = roomManager.getBySocket(socket.id);
    if (!room) return;
    const newDice = room.state.dice.map((d, i) =>
      kept[i] ? d : Math.floor(Math.random() * 6) + 1
    );
    room.state.dice = newDice;
    room.state.rollsLeft--;
    io.to(room.code).emit('game:state', { state: room.state });
  });

  socket.on('game:score', ({ categoryId }) => {
    // 유효성 검증 후 점수 기록
    const room = roomManager.getBySocket(socket.id);
    if (!room) return;
    const playerIdx = room.players.findIndex(p => p.id === socket.id);
    room.state.players[playerIdx].scores[categoryId] =
      calcScore(categoryId, room.state.dice);
    // 턴 넘기기, 게임 종료 체크
    advanceTurn(room, io);
  });

  socket.on('game:taunt', ({ emoji }) => {
    const room = roomManager.getBySocket(socket.id);
    if (!room) return;
    socket.to(room.code).emit('game:taunt:received', { emoji, from: socket.id });
  });

  socket.on('disconnect', () => {
    // 상대방에게 연결 끊김 알림
    const room = roomManager.getBySocket(socket.id);
    if (room) {
      socket.to(room.code).emit('room:opponent_disconnected');
      roomManager.remove(room.code);
    }
  });
});
```

---

## 코인 시스템

| 이벤트 | 코인 |
|---|---|
| 게임 승리 | +50 |
| 무승부 | +20 |
| 게임 패배 | +10 |
| 야트(50점) 달성 | +5 보너스 |
| 첫 로그인 (일일) | +30 |

스킨 가격:
- 클래식: 무료 (기본)
- 과일: 🪙 180
- 파이어: 🪙 150
- 스타: 🪙 200
- 보석: 🪙 250
- 우주: 🪙 300

---

## DB 스키마 (`server/db/schema.sql`)

```sql
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_token TEXT UNIQUE NOT NULL,
  nickname    TEXT,
  coins       INTEGER NOT NULL DEFAULT 120,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE owned_skins (
  user_id  UUID REFERENCES users(id),
  skin_id  TEXT NOT NULL,
  equipped BOOLEAN DEFAULT FALSE,
  PRIMARY KEY (user_id, skin_id)
);

CREATE TABLE game_results (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player1_id  UUID REFERENCES users(id),
  player2_id  UUID REFERENCES users(id),
  winner_id   UUID REFERENCES users(id),
  mode        TEXT NOT NULL,  -- 'bot' | 'online' | 'local'
  score1      INTEGER,
  score2      INTEGER,
  played_at   TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 온라인 매칭 (봇 위장) 흐름

```
1. 유저가 "온라인 대전" 클릭
2. 프론트에서 800ms~2500ms 랜덤 딜레이로 "매칭 중..." 애니메이션
3. 딜레이 후 "봇_[랜덤 닉네임]" 으로 연결됨
4. 실제로는 useBotAI 훅이 상대 턴을 처리
5. 게임 종료 후 서버에 결과 저장 (코인 지급)

// 향후 실제 PvP 추가 시:
// - 대기열 2명 이상이면 진짜 소켓 매칭
// - 30초 내 못 찾으면 봇으로 폴백
```

---

## PWA 설정

```typescript
// vite.config.ts
VitePWA({
  registerType: 'autoUpdate',
  manifest: {
    name: 'Yacht Dice',
    short_name: 'Yacht',
    theme_color: '#0D0F1A',
    background_color: '#0D0F1A',
    display: 'standalone',
    orientation: 'portrait',
    icons: [/* 192x192, 512x512 */],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
  },
})
```

---

## 디자인 토큰

```css
:root {
  --bg:       #0D0F1A;
  --surface:  #161929;
  --surface2: #1E2236;
  --surface3: #252A40;
  --accent:   #FF6B35;   /* 주 강조 (오렌지) */
  --accent2:  #FFD700;   /* 코인 / 골드 */
  --blue:     #4A9EFF;
  --green:    #4ADE80;
  --red:      #FF4A6B;
  --text:     #F0F2FF;
  --muted:    #8B90A8;
  --border:   #2D3354;
  --radius:   12px;
  --font-display: 'Black Han Sans', sans-serif;
  --font-body:    'Noto Sans KR', sans-serif;
}
```

---

## 구현 우선순위 (Codex 작업 순서 제안)

1. **[P0] 게임 코어** — `yacht.ts` 로직 + `useYachtGame.ts` 훅 + `DiceRack` + `Scorecard`
2. **[P0] 봇 AI** — `botAI.ts` + `useBotAI.ts` + 봇 턴 딜레이 연출
3. **[P0] 로컬 2인** — 같은 훅에서 `mode: 'local'`로 처리
4. **[P1] 코인 & 샵** — `userStore` + `ShopScreen` + `localStorage` 동기화
5. **[P1] 이모티콘 조롱** — `EmojiTauntBar` + `OpponentEmojiOverlay` 애니메이션
6. **[P1] 온라인 매칭 (봇 위장)** — 매칭 딜레이 연출 + 봇으로 시작
7. **[P2] 소켓 서버** — `room:create/join` + `game:roll/score` + `game:taunt`
8. **[P2] DB 연동** — 코인 서버 저장 + 스킨 구매 영구화
9. **[P3] PWA** — 홈 화면 추가 + 오프라인 캐시
10. **[P3] 실제 PvP 매칭** — 대기열 시스템 + 봇 폴백

---

## 주의사항 (Codex에게)

- 주사위 굴리기는 **서버에서 처리**해야 치트 방지 가능 (온라인 모드)
- 봇 턴은 **인위적 딜레이 필수** — 너무 빠르면 몰입감 깨짐
- 이모티콘 조롱은 **쿨타임 3초** 적용 (도배 방지)
- 모바일 터치 최적화: 모든 탭 타겟 최소 44×44px
- 주사위 "KEEP" 토글은 굴린 후에만 활성화
- 카테고리 선택은 굴린 후(`rolled === true`)에만 활성화
- 상단 보너스(+35)는 `ones~sixes` 합계 ≥ 63일 때 자동 부여
