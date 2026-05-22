export type GameMode = 'bot' | 'local' | 'online';

export type CategoryId =
  | 'ones'
  | 'twos'
  | 'threes'
  | 'fours'
  | 'fives'
  | 'sixes'
  | 'choice'
  | '4oak'
  | 'fh'
  | 'ss'
  | 'ls'
  | 'yacht';

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
  rollsLeft: number;
  rolled: boolean;
  round: number;
}

export const CATEGORIES: CategoryId[] = [
  'ones',
  'twos',
  'threes',
  'fours',
  'fives',
  'sixes',
  'choice',
  '4oak',
  'fh',
  'ss',
  'ls',
  'yacht',
];

export const CATEGORY_LABELS: Record<CategoryId, string> = {
  ones: 'Ones',
  twos: 'Twos',
  threes: 'Threes',
  fours: 'Fours',
  fives: 'Fives',
  sixes: 'Sixes',
  choice: 'Choice',
  '4oak': '4 of a Kind',
  fh: 'Full House',
  ss: 'Small Straight',
  ls: 'Large Straight',
  yacht: 'Yacht',
};
