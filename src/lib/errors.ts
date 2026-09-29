/** Friendly copy for RPC errors and command rejection reasons (section 15). */

const MESSAGES: Record<string, string> = {
  invalid_code: "That code doesn't match any TV. Check the letters and try again.",
  household_full: 'This home already has 4 players.',
  already_joined: "You're already in this home.",
  invalid_player: "We couldn't find that player in this home.",
  bad_name: 'Pick a name up to 20 characters.',
  forbidden: 'Something went wrong with your connection. Reload and try again.',
  not_authenticated: 'Something went wrong with your connection. Reload and try again.',
  not_your_turn: "Hold on, it's not your turn.",
  illegal_move: "That move isn't allowed.",
  cell_taken: 'That square is taken.',
  card_not_playable: "That card doesn't match.",
  wild4_not_allowed: 'You can only play +4 when you have no card of the current color.',
  must_play_drawn: 'Play the card you just drew, or pass.',
  already_drawn: 'You already drew this turn.',
  cannot_pass: 'You can only pass after drawing.',
  color_required: 'Pick a color for your wild card.',
  player_offline: 'Everyone needs to be connected first.',
  match_in_progress: 'Someone else already started a game.',
  stale: 'That took too long. Try again.',
  match_over: 'That match has ended.',
  no_active_match: 'That match has ended.',
  no_draw_offer: 'There is no draw offer to answer.',
  not_a_seat: "You're not playing in this match.",
  source_not_empty: 'That TV already has players of its own.',
  bad_status: 'Something went wrong. Reload and try again.',
  no_match: 'That match has ended.',
  version_conflict: 'Reload state and retry silently.',
};

export const FALLBACK_MESSAGE = 'Something went wrong. Try again.';

export const TV_OFFLINE_MESSAGE = "Hmm, the TV didn't answer. Check the TV is on.";

/** Map an error code (RPC exception or command reject reason) to friendly copy. */
export function friendlyMessage(code: string | null | undefined): string {
  if (!code) return FALLBACK_MESSAGE;
  return MESSAGES[code] ?? FALLBACK_MESSAGE;
}

const CHESS_RESULT_TEXT: Record<string, string> = {
  checkmate: 'Checkmate',
  stalemate: 'Stalemate',
  insufficient: 'Not enough pieces left',
  threefold: 'Same position three times',
  fifty_move: 'Fifty moves with no capture',
  draw_agreed: 'Draw agreed',
  resign: 'Resignation',
  three_in_row: 'Three in a row',
  draw: 'A draw',
  emptied_hand: 'First to empty their hand',
  quit: 'Match quit',
};

/** Short human description of how a match ended. */
export function resultText(result: string | null): string {
  if (!result) return 'Match over';
  return CHESS_RESULT_TEXT[result] ?? 'Match over';
}
