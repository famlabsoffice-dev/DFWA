import { 
  calculateNewRating, 
  getLeagueFromRating, 
  performSoftReset, 
  shouldResetSeason,
  getSeasonEndBonus,
  LEAGUE_TYPES 
} from '../server/social/leagues.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('Running League Logic Tests...');

// 1. Elo Calculation Test
const ratingA = 1000;
const ratingB = 1000;
const newRating = calculateNewRating(ratingA, ratingB, 1);
assert(newRating > 1000, 'Winner rating should increase');
console.log('✅ Elo Calculation Test passed');

// 2. League Assignment Test
assert(getLeagueFromRating(0) === LEAGUE_TYPES.BRONZE, '0 should be Bronze');
assert(getLeagueFromRating(1500) === LEAGUE_TYPES.SILVER, '1500 should be Silver');
assert(getLeagueFromRating(2500) === LEAGUE_TYPES.GOLD, '2500 should be Gold');
assert(getLeagueFromRating(4000) === LEAGUE_TYPES.PLATINUM, '4000 should be Platinum');
assert(getLeagueFromRating(6000) === LEAGUE_TYPES.DIAMOND, '6000 should be Diamond');
console.log('✅ League Assignment Test passed');

// 3. Soft Reset Test
const resetRating = performSoftReset(2000);
assert(resetRating === 1500, 'Soft reset of 2000 should be 1500');
console.log('✅ Soft Reset Test passed');

// 4. Season Reset Check
const oldDate = new Date();
oldDate.setDate(oldDate.getDate() - 31);
assert(shouldResetSeason(oldDate.toISOString()) === true, '31 days should trigger reset');
assert(shouldResetSeason(new Date().toISOString()) === false, 'Today should not trigger reset');
console.log('✅ Season Reset Check passed');

// 5. Season End Bonus
assert(getSeasonEndBonus(LEAGUE_TYPES.GOLD) === 500, 'Gold bonus should be 500');
console.log('✅ Season End Bonus Test passed');

console.log('All tests passed successfully!');
