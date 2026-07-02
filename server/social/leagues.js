/**
 * PHASE 5.1: GLOBAL LEAGUES LOGIC
 * Status: Implemented
 */

export const LEAGUE_TYPES = {
  BRONZE: 'BRONZE',
  SILVER: 'SILVER',
  GOLD: 'GOLD',
  PLATINUM: 'PLATINUM',
  DIAMOND: 'DIAMOND'
};

export const LEAGUE_THRESHOLDS = {
  [LEAGUE_TYPES.BRONZE]: 0,
  [LEAGUE_TYPES.SILVER]: 1000,
  [LEAGUE_TYPES.GOLD]: 2000,
  [LEAGUE_TYPES.PLATINUM]: 3500,
  [LEAGUE_TYPES.DIAMOND]: 5000
};

export const SEASON_CONFIG = {
  DURATION_DAYS: 30,
  RESET_STRATEGY: 'SOFT_RESET',
  K_FACTOR: 32 // Standard Elo K-Factor
};

/**
 * Calculates the expected score for Player A against Player B
 * @param {number} ratingA 
 * @param {number} ratingB 
 * @returns {number}
 */
export function getExpectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Calculates the new Elo rating after a match
 * @param {number} currentRating 
 * @param {number} opponentRating 
 * @param {number} actualScore (1 for win, 0.5 for draw, 0 for loss)
 * @returns {number}
 */
export function calculateNewRating(currentRating, opponentRating, actualScore) {
  const expectedScore = getExpectedScore(currentRating, opponentRating);
  return Math.round(currentRating + SEASON_CONFIG.K_FACTOR * (actualScore - expectedScore));
}

/**
 * Determines the league based on current Elo rating
 * @param {number} rating 
 * @returns {string}
 */
export function getLeagueFromRating(rating) {
  if (rating >= LEAGUE_THRESHOLDS.DIAMOND) return LEAGUE_TYPES.DIAMOND;
  if (rating >= LEAGUE_THRESHOLDS.PLATINUM) return LEAGUE_TYPES.PLATINUM;
  if (rating >= LEAGUE_THRESHOLDS.GOLD) return LEAGUE_TYPES.GOLD;
  if (rating >= LEAGUE_THRESHOLDS.SILVER) return LEAGUE_TYPES.SILVER;
  return LEAGUE_TYPES.BRONZE;
}

/**
 * Performs a soft reset for the new season
 * Formula: NewRating = 1000 + (CurrentRating - 1000) / 2
 * @param {number} currentRating 
 * @returns {number}
 */
export function performSoftReset(currentRating) {
  const baseline = 1000;
  return Math.round(baseline + (currentRating - baseline) / 2);
}
