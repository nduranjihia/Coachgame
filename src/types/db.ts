/* Shared database / domain types for Couch Clash. */

export type GameKey = 'tictactoe' | 'chess' | 'cards';

export type PlayerColor = 'coral' | 'sun' | 'mint' | 'sky' | 'grape' | 'rose';

export const PLAYER_COLORS: PlayerColor[] = ['coral', 'sun', 'mint', 'sky', 'grape', 'rose'];

export const PLAYER_EMOJIS = ['🦊', '🐼', '🐯', '🐸', '🦄', '🐙', '🐧', '🦁', '🐨', '🐰', '🦉', '🐳'] as const;

export interface HouseholdSettings {
  lastCardPenalty: boolean;
  sound: boolean;
  moveHints: boolean;
}

export const DEFAULT_SETTINGS: HouseholdSettings = {
  lastCardPenalty: true,
  sound: true,
  moveHints: true,
};

export interface Household {
  id: string;
  join_code: string;
  settings: HouseholdSettings;
  created_at: string;
}

export interface Player {
  id: string;
  household_id: string;
  auth_uid: string | null;
  name: string;
  emoji: string;
  color: PlayerColor;
  created_at: string;
}

/** The trimmed shape returned by the `preview_household` RPC. */
export interface PreviewPlayer {
  id: string;
  name: string;
  emoji: string;
  color: PlayerColor;
}

export interface HouseholdPreview {
  household_id: string;
  has_players: boolean;
  players: PreviewPlayer[];
}

export type MatchStatus = 'active' | 'finished' | 'abandoned';

export interface Match<S = unknown> {
  id: string;
  household_id: string;
  game: GameKey;
  status: MatchStatus;
  seats: string[];
  state: S;
  version: number;
  winner_id: string | null;
  result: string | null;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
}

export type CommandType =
  | 'start_match'
  | 'rematch'
  | 'quit_match'
  | 'move'
  | 'resign'
  | 'offer_draw'
  | 'respond_draw'
  | 'play'
  | 'draw'
  | 'pass';

export type CommandStatus = 'pending' | 'accepted' | 'rejected';

export interface Command {
  id: number;
  household_id: string;
  player_id: string;
  match_id: string | null;
  type: CommandType;
  payload: Record<string, any>;
  status: CommandStatus;
  reason: string | null;
  created_at: string;
}

export interface HandRow {
  match_id: string;
  player_id: string;
  household_id: string;
  cards: unknown[];
}

export interface MatchSecretRow {
  match_id: string;
  household_id: string;
  data: Record<string, any>;
}

export interface DeviceRow {
  id: string;
  household_id: string;
  auth_uid: string;
  kind: 'tv' | 'phone';
  created_at: string;
}

export type RejectReason =
  | 'not_your_turn'
  | 'illegal_move'
  | 'cell_taken'
  | 'bad_request'
  | 'match_over'
  | 'no_active_match'
  | 'player_offline'
  | 'stale'
  | 'card_not_playable'
  | 'must_play_drawn'
  | 'already_drawn'
  | 'cannot_pass'
  | 'wild4_not_allowed'
  | 'color_required'
  | 'no_draw_offer'
  | 'not_a_seat';

export type TttResult = 'three_in_row' | 'draw';
export type ChessResult =
  | 'checkmate'
  | 'stalemate'
  | 'insufficient'
  | 'threefold'
  | 'fifty_move'
  | 'draw_agreed'
  | 'resign';
export type CardsResult = 'emptied_hand';
export type MatchResult = TttResult | ChessResult | CardsResult | 'quit';
