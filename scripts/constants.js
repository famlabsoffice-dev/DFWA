export const API_ENDPOINTS = {
  LEADERBOARD: '/api/leaderboard',
  CHALLENGE_VERIFY: '/api/challenge/verify',
  CLIENT_ERROR: '/api/errors/client',
  ADMIN_RATELIMIT_LOGS: '/api/admin/ratelimit-logs',
  ADMIN_ERROR_LOGS: '/api/admin/error-logs',
  ANALYTICS: '/api/analytics',
  METRICS: '/api/metrics',
};

export const STORAGE_KEYS = {
  PLAYER_ID: 'playerId',
  PLAYER_NAME: 'playerName',
  HIGH_SCORE: 'highScore',
  BATTLE_STATS: 'battleStats',
  GAME_STATE: 'dfwa_state',
  LAST_VARIANT: 'lastVariant',
  ACHIEVEMENTS: 'dfwa_achievements',
  THEME: 'dfwa_theme',
};

export const ACHIEVEMENTS = {
  FIRST_WIN: { id: 'first_win', name: 'FIRST_LINK', desc: 'Erster Sieg im System.' },
  STREAK_5: { id: 'streak_5', name: 'DATA_FLOW', desc: '5 korrekte Antworten in Folge.' },
  STREAK_10: { id: 'streak_10', name: 'OVERRIDE', desc: '10 korrekte Antworten in Folge.' },
  PERFECT_GAME: { id: 'perfect_game', name: 'SYSTEM_SYNC', desc: 'Keine Fehler in einer Session.' },
};

export const SYSTEM_MESSAGES = {
  FETCH_QUESTIONS_ERROR:
    'Fragen konnten nicht geladen werden. Bitte versuchen Sie es später erneut.',
  FETCH_COMMENTS_ERROR:
    'Kommentare konnten nicht geladen werden. Das Spiel wird ohne Kommentare fortgesetzt.',
  STATE_OOB_ERROR: 'SYSTEM_ERROR: STATE_OUT_OF_BOUNDS',
};

export const GAME_MODES = {
  CLASSIC: 'classic',
  ENDLESS: 'endless',
  BLITZ: 'blitz',
};
