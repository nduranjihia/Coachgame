export const APP_NAME = 'Couch Clash';

export const TAGLINE = 'Game night, on the big screen.';

/** localStorage keys, all prefixed with `cc.` */
export const STORAGE = {
  role: 'cc.role',
  householdId: 'cc.householdId',
  playerId: 'cc.playerId',
} as const;

/** The alphabet used by the database `gen_join_code()` function. */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;

export const EMOJIS = ['🦊', '🐼', '🐯', '🐸', '🦄', '🐙', '🐧', '🦁', '🐨', '🐰', '🦉', '🐳'] as const;

export const PLAYER_COLORS = ['coral', 'sun', 'mint', 'sky', 'grape', 'rose'] as const;

export const PLAYER_COLOR_HEX: Record<(typeof PLAYER_COLORS)[number], string> = {
  coral: '#FF6B6B',
  sun: '#FFC857',
  mint: '#3DDC97',
  sky: '#4DB8FF',
  grape: '#A78BFA',
  rose: '#FF7EB6',
};

export const MAX_PLAYERS = 4;

/** Commands older than this are rejected as `stale` by the TV. */
export const COMMAND_STALE_MS = 5 * 60 * 1000;

/** How long a phone waits for the TV to answer before warning the user. */
export const COMMAND_TIMEOUT_MS = 4000;

/** Health-check poll interval. */
export const HEALTH_POLL_MS = 20_000;

/** TV poll interval for pending commands (safety net for missed realtime events). */
export const COMMAND_POLL_MS = 5_000;

/** How long the TV shows the result overlay before going back to Home. */
export const RESULT_HOLD_MS = 30_000;
