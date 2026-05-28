import { CardState } from './card.model';

export type GamePhase = 'draw' | 'main' | 'attack' | 'end';

export interface PlayerState {
  id: string; // 'player' or 'opponent' or user UUID
  hp: number; // max 4000
  deck: CardState[]; // Used to be string[] but we are putting full CardStates now // array of card instances or IDs
  hand: CardState[];
  field: CardState[]; // max 5
  graveyard: CardState[];
}

export interface GameState {
  matchId: string;
  turnNumber: number;
  currentPhase: GamePhase;
  currentPlayerId: string;
  player1: PlayerState;
  player2: PlayerState;
  winnerId: string | null;
  matchEndReason?: string;
  matchTimeRemaining: number;
  phaseTimeRemaining: number;
  pendingAction?: { type: 'draw_prompt', playerId: string, callback?: () => void } | null;
}
