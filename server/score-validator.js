const ModeConfig = {
  classic: {
    scoreMultiplier: 1,
    minScore: 100,
    maxScore: 50000,
  },
  timeAttack: {
    scoreMultiplier: 1.5,
    minScore: 150,
    maxScore: 75000,
  },
  hardcore: {
    scoreMultiplier: 2,
    minScore: 200,
    maxScore: 100000,
  },
  blitz: {
    scoreMultiplier: 1.2,
    minScore: 120,
    maxScore: 60000,
  },
};

export function validateScore(score, mode, baseScore) {
  if (!ModeConfig[mode]) {
    return { valid: false, reason: 'INVALID_MODE' };
  }

  const config = ModeConfig[mode];

  if (score < config.minScore || score > config.maxScore) {
    return { valid: false, reason: 'SCORE_OUT_OF_RANGE' };
  }

  if (baseScore && typeof baseScore === 'number') {
    const expectedMin = Math.floor(baseScore * config.scoreMultiplier * 0.8);
    const expectedMax = Math.floor(baseScore * config.scoreMultiplier * 1.2);

    if (score < expectedMin || score > expectedMax) {
      return { valid: false, reason: 'SCORE_MISMATCH_WITH_BASE' };
    }
  }

  return { valid: true };
}

export function getScoreMultiplier(mode) {
  return ModeConfig[mode]?.scoreMultiplier || 1;
}

export function normalizeScore(score, mode) {
  const multiplier = getScoreMultiplier(mode);
  return Math.floor(score / multiplier);
}
