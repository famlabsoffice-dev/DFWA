/**
 * PHASE 5.1: GLOBAL LEAGUES ARCHITECTURE
 * Status: Initial Scaffold
 */

export const LEAGUE_TYPES = {
  BRONZE: 'BRONZE',
  SILVER: 'SILVER',
  GOLD: 'GOLD',
  PLATINUM: 'PLATINUM',
  DIAMOND: 'DIAMOND'
};

export const SEASON_CONFIG = {
  DURATION_DAYS: 30,
  RESET_STRATEGY: 'SOFT_RESET'
};

/**
 * TODO: Implement League Logic
 * - Calculate user rank based on Elo/Points
 * - Handle seasonal reset and rewards
 * - Integrate with existing Leaderboard DB
 */
