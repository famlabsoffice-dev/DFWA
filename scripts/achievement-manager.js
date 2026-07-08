export const AchievementManager = {
  ACHIEVEMENTS: [
    { id: 'FIRST_WIN', name: 'First Win', icon: '🏆', description: 'Complete your first session.', condition: (state) => state.score > 0 },
    { id: 'STREAK_5', name: 'Novice Hacker', icon: '⚡', description: 'Reach a streak of 5.', condition: (state) => state.streak >= 5 },
    { id: 'STREAK_10', name: 'Code Breaker', icon: '🔓', description: 'Reach a streak of 10.', condition: (state) => state.streak >= 10 },
    { id: 'SCORE_1000', name: 'Elite Operative', icon: '💎', description: 'Score over 1000 points.', condition: (state) => state.score >= 1000 },
    { id: 'SURVIVOR', name: 'System Survivor', icon: '💀', description: 'Complete a hardcore session.', condition: (state) => state.selectedMode === 'hardcore' && state.score > 0 }
  ],

  checkAchievements(state, currentAchievements = []) {
    const unlocked = [];
    this.ACHIEVEMENTS.forEach(ach => {
      if (!currentAchievements.includes(ach.id) && ach.condition(state)) {
        unlocked.push(ach.id);
      }
    });
    return unlocked;
  },

  getAchievementNames(ids) {
    return this.ACHIEVEMENTS
      .filter(ach => ids.includes(ach.id))
      .map(ach => ach.name);
  }
};
