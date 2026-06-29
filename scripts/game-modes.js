export const GameModes = {
  CLASSIC: 'classic',
  TIME_ATTACK: 'timeAttack',
  HARDCORE: 'hardcore',
};

export const ModeConfig = {
  classic: {
    name: 'Classic',
    description: 'Standard mode with 3 lives',
    initialLives: 3,
    initialTimer: 15,
    timerDecrement: 1,
    scoreMultiplier: 1,
    streakBonus: true,
    timeBonus: true,
  },
  timeAttack: {
    name: 'Time Attack',
    description: 'Answer as many questions as possible in 60 seconds',
    initialLives: 1,
    initialTimer: 60,
    timerDecrement: 1,
    scoreMultiplier: 1.5,
    streakBonus: true,
    timeBonus: false,
    isTimeAttack: true,
  },
  hardcore: {
    name: 'Hardcore',
    description: 'One life, 10 second timer, 2x score multiplier',
    initialLives: 1,
    initialTimer: 10,
    timerDecrement: 1,
    scoreMultiplier: 2,
    streakBonus: true,
    timeBonus: true,
  },
};

export function getGameModeConfig(mode) {
  return ModeConfig[mode] || ModeConfig.classic;
}

export function calculateModeScore(baseScore, mode, timer, streak) {
  const config = getGameModeConfig(mode);
  let score = baseScore * config.scoreMultiplier;

  if (config.streakBonus) {
    const streakBonus = Math.min((streak - 1) * 10, 100);
    score += streakBonus;
  }

  if (config.timeBonus) {
    const timeBonus = Math.min(Math.floor(timer * 2), 30);
    score += timeBonus;
  }

  return Math.floor(score);
}
