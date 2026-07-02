import { APIClient } from './scripts/api-client.js';
import { UIManager } from './scripts/ui-manager.js';
import {
  GameModes,
  ModeConfig,
  getGameModeConfig,
} from './scripts/game-modes.js';
import { ACHIEVEMENTS as ACHIEV_CONST, STORAGE_KEYS } from './scripts/constants.js';

const API_BASE_URL =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : window.location.origin;

let state = {
  lang: 'de',
  questions: [],
  allQuestions: [],
  current: 0,
  score: 0,
  lives: 3,
  streak: 0,
  streakMax: 0,
  correctAnswers: 0,
  playerName: localStorage.getItem('dfwa_name') || 'GUEST',
  playerId: localStorage.getItem('dfwa_id') || Math.floor(1000 + Math.random() * 9000).toString(),
  best: parseInt(localStorage.getItem('dfwa_best') || 0),
  wins: parseInt(localStorage.getItem('dfwa_wins') || 0),
  losses: parseInt(localStorage.getItem('dfwa_losses') || 0),
  comments: {},
  usedComments: { correct: [], incorrect: [] },
  isPaused: false,
  isProcessing: false,
  timer: 15, // Default initial value, will be synced from ModeConfig
  timerInterval: null,
  questionCount: 0,
  isChallenge: false,
  isCreatingChallenge: false,
  challengeSeed: null,
  opponentScore: 0,
  pausedQuestion: null,
  pausedTimer: null,
  cheatsAttempted: false,
  systemSecret: 'LOCAL_ONLY_UNTRUSTED',
  sessionActive: false,
  lastUpdateTime: null,
  timerEndTimestamp: null,
  baseDate: Date.now(),
  basePerf: performance.now(),
  timeDesyncDetected: false,
  mode: localStorage.getItem('dfwa_mode') || 'classic',
  variant: localStorage.getItem('dfwa_variant') || (Math.random() < 0.5 ? 'A' : 'B'),
  achievements: JSON.parse(localStorage.getItem(STORAGE_KEYS.ACHIEVEMENTS) || '[]'),
  theme: localStorage.getItem(STORAGE_KEYS.THEME) || 'default',
};
if (!localStorage.getItem('dfwa_variant')) localStorage.setItem('dfwa_variant', state.variant);

// Global Error Handler
window.addEventListener('error', async (event) => {
  const errorData = {
    message: event.message,
    stack: event.error ? event.error.stack : null,
    stateSnapshot: {
      mode: state.mode,
      current: state.current,
      score: state.score,
    },
  };
  console.error('GLOBAL_ERROR_CAPTURED:', errorData);
  try {
    await APIClient.logClientError(API_BASE_URL, errorData);
  } catch {
    console.error('API_LOG_FAILED');
  }
});

window.addEventListener('unhandledrejection', async (event) => {
  const errorData = {
    message: event.reason ? event.reason.message || event.reason : 'Unhandled Rejection',
    stack: event.reason && event.reason.stack ? event.reason.stack : null,
    stateSnapshot: {
      mode: state.mode,
      current: state.current,
      score: state.score,
    },
  };
  console.error('UNHANDLED_REJECTION_CAPTURED:', errorData);
  try {
    await APIClient.logClientError(API_BASE_URL, errorData);
  } catch {
    console.error('API_LOG_FAILED');
  }
});

const SESSION_VERSION = 1;

function saveSession() {
  if (!state.sessionActive) return;

  const lockKey = 'session_write_lock';
  const myLock = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    localStorage.setItem(lockKey, myLock);

    setTimeout(() => {
      try {
        if (localStorage.getItem(lockKey) !== myLock) return;

        const sessionData = {
          version: SESSION_VERSION,
          current: state.current,
          score: state.score,
          lives: state.lives,
          streak: state.streak,
          streakMax: state.streakMax,
          correctAnswers: state.correctAnswers,
          questionCount: state.questionCount,
          challengeSeed: state.challengeSeed,
          isChallenge: state.isChallenge,
          timer: state.timer,
          lastUpdateTime: Date.now(),
          timerEndTimestamp: state.timerInterval ? Date.now() + state.timer * 1000 : null,
        };

        const tempKey = 'dfwa_session_temp';
        localStorage.setItem(tempKey, JSON.stringify(sessionData));
        localStorage.setItem('dfwa_session', localStorage.getItem(tempKey));
        localStorage.removeItem(tempKey);
      } catch {
        console.error('Session write failed');
      } finally {
        if (localStorage.getItem(lockKey) === myLock) {
          localStorage.removeItem(lockKey);
        }
      }
    }, 10);
  } catch {
    console.error('Lock acquisition failed');
  }
}

function clearSession() {
  try {
    state.sessionActive = false;
    localStorage.removeItem('dfwa_session');
    localStorage.removeItem('session_write_lock');
  } catch {
    console.error('Clear session failed');
  }
}

async function restoreSession() {
  try {
    const data = localStorage.getItem('dfwa_session');
    if (!data) return false;
    const session = JSON.parse(data);

    if (!session.version || session.version !== SESSION_VERSION) {
      console.warn('Session version mismatch. Resetting.');
      clearSession();
      return false;
    }

    state.current = session.current;
    state.score = session.score;
    state.lives = session.lives;
    state.streak = session.streak;
    state.streakMax = session.streakMax;
    state.correctAnswers = session.correctAnswers;
    state.questionCount = session.questionCount;
    state.challengeSeed = session.challengeSeed;
    state.isChallenge = session.isChallenge;

    if (session.timerEndTimestamp) {
      const remaining = (session.timerEndTimestamp - Date.now()) / 1000;
      state.timer = Math.max(0, remaining);
    } else {
      state.timer = session.timer;
    }

    if (state.lives <= 0 || state.timer <= 0) {
      clearSession();
      return false;
    }

    state.sessionActive = true;
    await initGame(false, true);
    return true;
  } catch {
    console.error('Restore session failed');
    clearSession();
    return false;
  }
}

// Globaler Error Handler
window.onerror = (message, source, lineno, colno, error) => {
  APIClient.reportError(API_BASE_URL, {
    message: message,
    stack: error ? error.stack : `at ${source}:${lineno}:${colno}`,
    stateSnapshot: {
      current: state.current,
      score: state.score,
      lives: state.lives,
      mode: state.mode,
      sessionActive: state.sessionActive,
    },
  });
};

window.onunhandledrejection = (event) => {
  APIClient.reportError(API_BASE_URL, {
    message: `Unhandled Rejection: ${event.reason}`,
    stack: event.reason ? event.reason.stack : null,
    stateSnapshot: {
      current: state.current,
      score: state.score,
      lives: state.lives,
      mode: state.mode,
      sessionActive: state.sessionActive,
    },
  });
};

async function fetchSystemSecret() {
  try {
    const res = await fetch(`${API_BASE_URL}/config/secret`);
    if (res.ok) {
      const data = await res.json();
      state.systemSecret = data.secret;
    } else {
      state.systemSecret = 'LOCAL_ONLY_UNTRUSTED';
    }
  } catch {
    state.systemSecret = 'LOCAL_ONLY_UNTRUSTED';
  }
  try {
    await validateStorage();
  } catch {
    console.error('Storage validation failed');
  }
}
fetchSystemSecret();

async function getSignature(data) {
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(state.systemSecret || 'LOCAL_ONLY_UNTRUSTED'),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
    return Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    console.error('Signature generation failed');
    return 'SIGNATURE_ERROR';
  }
}

async function saveSecure(key, value) {
  try {
    localStorage.setItem(key, value);
    const sig = await getSignature(value.toString());
    localStorage.setItem(`${key}_sig`, sig);
  } catch {
    console.error(`Secure save failed for ${key}`);
  }
}

async function validateStorage() {
  try {
    const keys = ['dfwa_best', 'dfwa_wins', 'dfwa_losses'];
    for (const key of keys) {
      const val = localStorage.getItem(key);
      const sig = localStorage.getItem(`${key}_sig`);
      if (val && sig) {
        const expected = await getSignature(val.toString());
        if (sig !== expected) {
          console.warn(`INTEGRITY_FAILURE: ${key} tampered. Resetting.`);
          localStorage.removeItem(key);
          localStorage.removeItem(`${key}_sig`);
          if (key === 'dfwa_best') state.best = 0;
          if (key === 'dfwa_wins') state.wins = 0;
          if (key === 'dfwa_losses') state.losses = 0;
        }
      }
    }
    const highScoreEl = document.getElementById('high-score');
    if (highScoreEl) highScoreEl.innerText = state.best;
    const battleStatsEl = document.getElementById('battle-stats');
    if (battleStatsEl) battleStatsEl.innerText = `W:${state.wins} / L:${state.losses}`;
  } catch {
    console.error('Storage validation process failed');
  }
}

function detectLanguage() {
  try {
    const saved = localStorage.getItem('dfwa_lang');
    if (saved) {
      state.lang = saved;
    } else {
      state.lang = navigator.language.startsWith('de') ? 'de' : 'en';
    }

    if (!localStorage.getItem('dfwa_id')) {
      saveSecure('dfwa_id', state.playerId);
    }
    updateUIForLanguage();
  } catch {
    console.error('Language detection failed');
    state.lang = 'de';
    updateUIForLanguage();
  }
}

function updateUIForLanguage() {
  try {
    document.documentElement.lang = state.lang;
    const elements = {
      'start-btn': () => (state.lang === 'de' ? 'PROTOKOLL_STARTEN' : 'INIT_PROTOCOL'),
      'player-display': () => state.playerName,
      'id-display': () => state.playerId,
      'high-score': () => state.best,
      'battle-stats': () => `W:${state.wins} / L:${state.losses}`,
      'player-name': () => (state.playerName !== 'GUEST' ? state.playerName : ''),
    };

    for (const [id, valueFn] of Object.entries(elements)) {
      const el = document.getElementById(id);
      if (el) {
        if (el.tagName === 'INPUT') el.value = valueFn();
        else el.innerText = valueFn();
      }
    }
  } catch {
    console.error('UI update failed');
  }
}

/*
function setLanguage(lang) {
  try {
    state.lang = lang;
    localStorage.setItem('dfwa_lang', lang);
    updateUIForLanguage();
  } catch {
    console.error('Set language failed');
  }
}
*/

function setGameMode(mode) {
  try {
    if (!Object.values(GameModes).includes(mode)) {
      console.warn('Invalid game mode: ' + mode + '. Defaulting to classic.');
      mode = GameModes.CLASSIC;
    }
    state.mode = mode;
    localStorage.setItem('dfwa_mode', mode);
    const config = getGameModeConfig(mode);
    state.lives = config.initialLives;
    state.timer = config.initialTimer;
  } catch {
    console.error('Set game mode failed');
  }
}

detectLanguage();

function applyTheme(themeName) {
  state.theme = themeName;
  localStorage.setItem(STORAGE_KEYS.THEME, themeName);
  document.body.className = themeName === 'default' ? '' : `theme-${themeName}`;
}

// Apply initial theme
applyTheme(state.theme);

document.querySelectorAll('.theme-dot').forEach((dot) => {
  dot.addEventListener('click', () => {
    applyTheme(dot.dataset.theme);
    document.querySelectorAll('.theme-dot').forEach((d) => (d.style.borderWidth = '1px'));
    dot.style.borderWidth = '2px';
  });
});

const muteBtn = document.getElementById('mute-btn');
if (muteBtn) {
  muteBtn.innerText = AudioManager.isMuted ? 'SOUND: OFF' : 'SOUND: ON';
  muteBtn.addEventListener('click', () => {
    const muted = AudioManager.toggleMute();
    muteBtn.innerText = muted ? 'SOUND: OFF' : 'SOUND: ON';
  });
}

function unlockAchievement(achievementId) {
  if (state.achievements.includes(achievementId)) return;

  const achievement = Object.values(ACHIEV_CONST).find((a) => a.id === achievementId);
  if (!achievement) return;

  state.achievements.push(achievementId);
  localStorage.setItem(STORAGE_KEYS.ACHIEVEMENTS, JSON.stringify(state.achievements));

  const toast = document.createElement('div');
  toast.className = 'achievement-toast';
  toast.innerHTML = `<strong>ACHIEVEMENT_UNLOCKED</strong><br>${achievement.name}`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function checkAchievements() {
  if (state.wins > 0) unlockAchievement(ACHIEV_CONST.FIRST_WIN.id);
  if (state.streak >= 5) unlockAchievement(ACHIEV_CONST.STREAK_5.id);
  if (state.streak >= 10) unlockAchievement(ACHIEV_CONST.STREAK_10.id);
  if (state.lives === 3 && state.correctAnswers >= 10)
    unlockAchievement(ACHIEV_CONST.PERFECT_GAME.id);
}

function renderModeSelector() {
  try {
    const container = document.getElementById('mode-selector');
    if (!container) return;
    container.innerHTML = '';
    Object.entries(ModeConfig).forEach(([key, config]) => {
      const btn = document.createElement('button');
      btn.className = 'mode-btn' + (state.mode === key ? ' active' : '');
      btn.dataset.mode = key;
      btn.innerHTML =
        '<strong>' + config.name + '</strong><small>' + config.description + '</small>';
      btn.onclick = () => {
        setGameMode(key);
        renderModeSelector();
      };
      container.appendChild(btn);
    });
  } catch {
    console.error('Render mode selector failed');
  }
}

function showLobby() {
  try {
    const nameInput = document.getElementById('player-name');
    state.playerName = nameInput ? nameInput.value.trim() || 'GUEST' : 'GUEST';
    saveSecure('dfwa_name', state.playerName);
    const startScreen = document.getElementById('start-screen');
    const battleLobby = document.getElementById('battle-lobby');
    if (startScreen) startScreen.classList.remove('active');
    if (battleLobby) battleLobby.classList.add('active');
    renderModeSelector();
  } catch {
    console.error('Show lobby failed');
  }
}

function hideLobby() {
  try {
    const battleLobby = document.getElementById('battle-lobby');
    const startScreen = document.getElementById('start-screen');
    if (battleLobby) battleLobby.classList.remove('active');
    if (startScreen) startScreen.classList.add('active');
  } catch {
    console.error('Hide lobby failed');
  }
}

async function startChallenge() {
  try {
    const codeInput = document.getElementById('challenge-code-input');
    const code = codeInput ? codeInput.value.trim() : '';
    if (code) {
      try {
        const data = JSON.parse(atob(code));
        if (!data.seed || data.score === undefined || !data.sig) throw new Error('INVALID');

        const payload = { seed: data.seed, score: data.score, ts: data.ts };
        const expectedSig = (await getSignature(JSON.stringify(payload))).slice(0, 16);

        if (data.sig !== expectedSig) {
          console.warn('CHALLENGE_INTEGRITY_FAIL: Code tampered.');
        }

        const age = Date.now() - (data.ts || 0);
        if (age > 86400000) throw new Error('EXPIRED');
        state.isChallenge = true;
        state.challengeSeed = data.seed;
        state.opponentScore = data.score;
        await initGame(false);
      } catch (e) {
        if (codeInput) {
          codeInput.value = '';
          codeInput.placeholder =
            e.message === 'EXPIRED'
              ? state.lang === 'de'
                ? 'CODE_ABGELAUFEN'
                : 'CODE_EXPIRED'
              : state.lang === 'de'
                ? 'UNGÜLTIGER_CODE'
                : 'INVALID_CODE';
          setTimeout(() => {
            codeInput.placeholder = state.lang === 'de' ? 'CODE_EINGEBEN' : 'ENTER_CODE';
          }, 2000);
        }
      }
    } else {
      await initGame(true);
    }
  } catch {
    console.error('Start challenge failed');
  }
}

async function generateChallengeCode() {
  try {
    const seed = Math.floor(Math.random() * 1000000);
    const payload = { seed, score: state.score, ts: Date.now() };
    const msg = JSON.stringify(payload);
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(state.systemSecret || 'LOCAL_ONLY_UNTRUSTED'),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
    const sigHex = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 16);
    return btoa(JSON.stringify({ ...payload, sig: sigHex }));
  } catch {
    console.error('Challenge code generation failed');
    return 'ERROR_GENERATING_CODE';
  }
}

function shuffle(array, seed) {
  try {
    let m = array.length,
      t,
      i;
    while (m) {
      i = Math.floor((seed ? (Math.sin(seed++) * 10000) % 1 : Math.random()) * m--);
      t = array[m];
      array[m] = array[i];
      array[i] = t;
    }
    return array;
  } catch {
    console.error('Shuffle failed');
    return array;
  }
}

function pauseProtocol() {
  try {
    state.isPaused = true;
    state.cheatsAttempted = false;
    state.pausedQuestion = state.current;
    state.pausedTimer = state.timer;
    state.timerEndTimestamp = null;
    clearInterval(state.timerInterval);
    const gameScreen = document.getElementById('game-screen');
    const startScreen = document.getElementById('start-screen');
    const resumeBtn = document.getElementById('resume-btn');
    if (gameScreen) gameScreen.classList.remove('active');
    if (startScreen) startScreen.classList.add('active');
    if (resumeBtn) resumeBtn.style.display = 'block';
    saveSession();
  } catch {
    console.error('Pause protocol failed');
  }
}

function resumeProtocol() {
  try {
    if (state.cheatsAttempted) {
      const btn = document.getElementById('resume-btn');
      if (btn) {
        btn.innerText = state.lang === 'de' ? 'CHEAT_ERKANNT' : 'CHEAT_DETECTED';
        setTimeout(() => {
          btn.innerText = 'RESUME_PROTOCOL';
          initGame(false);
        }, 1500);
      }
      return;
    }
    state.isPaused = false;
    const startScreen = document.getElementById('start-screen');
    const gameScreen = document.getElementById('game-screen');
    const resumeBtn = document.getElementById('resume-btn');
    if (startScreen) startScreen.classList.remove('active');
    if (gameScreen) gameScreen.classList.add('active');
    if (resumeBtn) resumeBtn.style.display = 'none';

    const config = getGameModeConfig(state.mode);
    state.timer =
      state.pausedTimer !== null && state.pausedTimer > 0 ? state.pausedTimer : config.initialTimer;
    state.pausedTimer = null;
    state.timerEndTimestamp = Date.now() + state.timer * 1000;

    startTimer();
    saveSession();
  } catch {
    console.error('Resume protocol failed');
  }
}

async function initGame(createChallenge, isRestoring = false) {
  try {
    const nameInput = document.getElementById('player-name');
    state.playerName = nameInput ? nameInput.value.trim() || 'GUEST' : 'GUEST';
    saveSecure('dfwa_name', state.playerName);

    if (!isRestoring) {
      const activeModeBtn = document.querySelector('#mode-selector .mode-btn.active');
      state.mode = activeModeBtn ? activeModeBtn.dataset.mode : 'classic';
      const config = getGameModeConfig(state.mode);

      state.lives = config.initialLives;
      state.current = 0;
      state.score = 0;
      state.questionCount = 0;
      state.streak = 0;
      state.streakMax = 0;
      state.correctAnswers = 0;
      state.isChallenge = false;
      state.isCreatingChallenge = createChallenge;
      state.isPaused = false;
      state.cheatsAttempted = false;
      state.pausedTimer = null;
      state.sessionActive = true;
      state.timer = config.initialTimer;
    }

    const livesDisplay = document.getElementById('lives-display');
    if (livesDisplay) livesDisplay.innerText = state.lives;
    const resumeBtn = document.getElementById('resume-btn');
    if (resumeBtn) resumeBtn.style.display = 'none';
    state.usedComments = { correct: [], incorrect: [] };

    try {
      const cRes = await fetch('ack_comments.json');
      if (!cRes.ok) throw new Error('FETCH_FAILED');
      state.comments = await cRes.json();

      let allQuestions = window._dfwaQCache;
      if (!allQuestions) {
        const qRes = await fetch('questions_i18n.json');
        if (!qRes.ok) throw new Error('FETCH_FAILED');
        allQuestions = await qRes.json();
        window._dfwaQCache = allQuestions;
      }
      state.allQuestions = allQuestions;

      if (allQuestions.length === 0) throw new Error('NO_QUESTIONS');

      state.questions = shuffle([...allQuestions], state.isChallenge ? state.challengeSeed : null);
      const config = getGameModeConfig(state.mode);
      if (config.maxQuestions) state.questions = state.questions.slice(0, config.maxQuestions);

      const startScreen = document.getElementById('start-screen');
      const battleLobby = document.getElementById('battle-lobby');
      const gameScreen = document.getElementById('game-screen');
      if (startScreen) startScreen.classList.remove('active');
      if (battleLobby) battleLobby.classList.remove('active');
      if (gameScreen) gameScreen.classList.add('active');

      const hudScore = document.getElementById('hud-score');
      if (hudScore) hudScore.innerText = '0_PTS';
      const hudStreak = document.getElementById('hud-streak');
      if (hudStreak) hudStreak.style.display = 'none';
      const hudMode = document.getElementById('hud-mode');
      if (hudMode) hudMode.innerText = state.mode.toUpperCase();

      const modalTitle = document.getElementById('modal-title');
      if (modalTitle) modalTitle.style.color = 'var(--warning)';
      const modalOverlay = document.getElementById('modal-overlay');
      if (modalOverlay) modalOverlay.style.display = 'none';

      renderQuestion(isRestoring);
      saveSession();
    } catch (e) {
      const startBtn = document.getElementById('start-btn');
      if (startBtn) {
        startBtn.innerText =
          e.message === 'NO_QUESTIONS'
            ? state.lang === 'de'
              ? 'FEHLER: LEERER_SEKTOR'
              : 'ERROR: EMPTY_SECTOR'
            : state.lang === 'de'
              ? 'FEHLER: SYSTEM_OFFLINE'
              : 'ERROR: SYSTEM_OFFLINE';
        setTimeout(() => {
          startBtn.innerText = state.lang === 'de' ? 'PROTOKOLL_STARTEN' : 'INIT_PROTOCOL';
        }, 3000);
      }
    }
  } catch {
    console.error('Log client error failed');
  }
}

function renderQuestion(isRestoring = false) {
  try {
    if (state.lives <= 0) return endGame();
    const q = state.questions[state.current];
    if (!q) return endGame();

    const catDisplay = document.getElementById('cat-display');
    if (catDisplay) catDisplay.innerText = `[${q.cat.toUpperCase()}]`;
    const questionText = document.getElementById('question-text');
    if (questionText) questionText.innerText = q.text[state.lang];

    const container = document.getElementById('options-container');
    if (container) {
      container.innerHTML = '';
      q.options[state.lang].forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerText = opt;
        btn.addEventListener('click', () => {
          AudioManager.play('click');
          checkAnswer(idx === q.correct);
        });
        container.appendChild(btn);
      });
    }

    if (!isRestoring) {
      const config = getGameModeConfig(state.mode);
      state.timer = config.initialTimer;
      state.timerEndTimestamp = Date.now() + state.timer * 1000;
    }
    startTimer();
  } catch {
    console.error('Next question failed');
    endGame();
  }
}

function startTimer() {
  try {
    clearInterval(state.timerInterval);
    const bar = document.getElementById('timer-bar');
    const timerText = document.getElementById('timer-text');

    state.timerInterval = setInterval(() => {
      if (state.isPaused) return;

      const now = Date.now();
      const remaining = Math.max(0, (state.timerEndTimestamp - now) / 1000);
      state.timer = remaining;

      const config = getGameModeConfig(state.mode);
      if (bar) bar.style.width = `${(state.timer / config.initialTimer) * 100}%`;
      if (timerText) timerText.innerText = `${Math.ceil(state.timer)}S`;

      if (state.timer <= 0) {
        clearInterval(state.timerInterval);
        checkAnswer(null);
      }
    }, 50);
  } catch {
    console.error('Update high score failed');
  }
}

async function updateLeaderboard() {
  if (state.isSubmitting) return;
  state.isSubmitting = true;
  try {
    const accuracy =
      state.questionCount > 0 ? Math.round((state.correctAnswers / state.questionCount) * 100) : 0;
    const payload = {
      playerId: state.playerId,
      playerName: state.playerName,
      score: state.score,
      wins: state.wins,
      losses: state.losses,
      variant: state.variant,
      accuracy: accuracy,
      mode: state.mode,
    };
    await APIClient.updateLeaderboard(API_BASE_URL, payload, state.systemSecret);
    console.log('Score submitted');
  } catch {
    console.warn('Leaderboard update failed (offline mode)');
  } finally {
    state.isSubmitting = false;
  }
}

async function endGame() {
  try {
    clearSession();
    clearInterval(state.timerInterval);
    const overlay = document.getElementById('modal-overlay');
    const text = document.getElementById('modal-text');
    const title = document.getElementById('modal-title');

    const isNewBest = state.score > state.best;
    const livesDisplay = document.getElementById('lives-display');
    if (livesDisplay) livesDisplay.innerText = state.lives;

    if (isNewBest) {
      state.best = state.score;
      await saveSecure('dfwa_best', state.best);
      const highScoreEl = document.getElementById('high-score');
      if (highScoreEl) highScoreEl.innerText = state.best;
    }

    if (overlay) overlay.style.display = 'flex';

    if (state.isCreatingChallenge) {
      if (title) title.innerText = 'CHALLENGE_CREATED';
      if (text) text.innerText = 'GENERATING...';
      const modalContent = document.querySelector('.modal-content');
      if (modalContent) modalContent.style.backgroundImage = "url('./assets/images/ack_override_alien.png')";
      generateChallengeCode().then((code) => {
        if (text) text.innerText = code;
      });
    } else if (state.isChallenge) {
      const win = state.score > state.opponentScore;
      const modalContent = document.querySelector('.modal-content');
      if (modalContent) {
        modalContent.style.backgroundImage = win ? "url('./assets/images/ack_player_win_angry.png')" : "url('./assets/images/ack_victory.png')";
        modalContent.style.backgroundSize = 'cover';
        modalContent.style.backgroundPosition = 'center';
      }
      if (title) {
        title.style.color = win ? 'var(--neon)' : 'var(--error)';
        title.innerText = win ? 'VICTORY' : 'DEFEAT';
      }
      if (text) text.innerText = `YOUR_SCORE: ${state.score}\nOPPONENT: ${state.opponentScore}`;
      if (win) {
        state.wins++;
        await saveSecure('dfwa_wins', state.wins);
      } else {
        state.losses++;
        await saveSecure('dfwa_losses', state.losses);
      }
      const battleStatsEl = document.getElementById('battle-stats');
      if (battleStatsEl) battleStatsEl.innerText = `W:${state.wins} / L:${state.losses}`;
      checkAchievements();
    } else {
      if (title) {
        title.style.color = isNewBest ? 'var(--warning)' : 'var(--neon)';
        title.innerText = isNewBest ? 'NEW_PEAK_DATA' : 'PROTOCOL_COMPLETE';
      }
      const accuracy =
        state.questionCount > 0
          ? Math.round((state.correctAnswers / state.questionCount) * 100)
          : 0;
      if (text)
        text.innerText = `FINAL_SCORE: ${state.score}\nPEAK_DATA: ${state.best}\nACCURACY: ${accuracy}%`;
    }

    await updateLeaderboard();
  } catch {
    console.error('Init game failed');
  }
}

function getComment(type) {
  try {
    let pool = state.comments[state.lang][type];
    if (state.variant === 'A') {
      pool = pool.filter((c) => c.includes('?') || c.length > 40);
    } else {
      pool = pool.filter((c) => !c.includes('?') && c.length <= 40);
    }
    if (pool.length === 0) pool = state.comments[state.lang][type];

    let available = pool.filter((c) => !state.usedComments[type].includes(c));
    if (available.length === 0) {
      state.usedComments[type] = [];
      available = pool;
    }
    let choice = available[Math.floor(Math.random() * available.length)];
    state.usedComments[type].push(choice);
    return choice;
  } catch {
    console.error('Get random comment failed');
    return type === 'correct' ? 'CORRECT' : 'INCORRECT';
  }
}

function checkAnswer(correct) {
  try {
    if (state.isProcessing) return;
    state.isProcessing = true;
    clearInterval(state.timerInterval);
    state.questionCount++;
    saveSession();

    const fScreen = document.getElementById('feedback-screen');
    const fContainer = document.getElementById('feedback-eye-container');
    const fEyeBase = document.getElementById('feedback-eye-base');
    const fMsg = document.getElementById('feedback-msg');

    if (fContainer) fContainer.classList.remove('zoom-anim');

    if (correct) {
      state.streak++;
      state.correctAnswers++;
      if (state.streak > state.streakMax) state.streakMax = state.streak;
      const streakBonus = Math.min((state.streak - 1) * 10, 100);
      const timeBonus = Math.min(Math.floor(state.timer * 2), 30);
      state.score += 100 + streakBonus + timeBonus;
      saveSession();
      const hudScore = document.getElementById('hud-score');
      if (hudScore) hudScore.innerText = `${state.score}_PTS`;
      const hudStreak = document.getElementById('hud-streak');
      if (hudStreak) {
        if (state.streak >= 2) {
          hudStreak.style.display = 'inline';
          const streakCount = document.getElementById('hud-streak-count');
          if (streakCount) streakCount.innerText = state.streak;
        } else {
          hudStreak.style.display = 'none';
        }
      }
      if (fEyeBase) fEyeBase.src = './assets/images/ack_reaction_set.png';
      if (fMsg) {
        fMsg.style.borderColor = 'var(--neon)';
        fMsg.style.color = 'var(--neon)';
        fMsg.innerText = getComment('correct');
      }
      checkAchievements();
    } else if (correct === false) {
      state.lives = Math.max(0, state.lives - 1);
      state.streak = 0;
      saveSession();
      const hudStreak = document.getElementById('hud-streak');
      if (hudStreak) hudStreak.style.display = 'none';
      const livesDisplay = document.getElementById('lives-display');
      if (livesDisplay) livesDisplay.innerText = state.lives;
      if (fEyeBase) fEyeBase.src = './assets/images/ack_interference_glitch.png';
      if (fContainer) fContainer.classList.add('zoom-anim');
      if (fMsg) {
        fMsg.style.borderColor = 'var(--error)';
        fMsg.style.color = 'var(--error)';
        fMsg.innerText = getComment('incorrect');
      }
    } else {
      state.lives = Math.max(0, state.lives - 1);
      state.streak = 0;
      saveSession();
      if (fEyeBase) fEyeBase.src = './assets/images/ack_core_clean.webp';
      if (fMsg) {
        fMsg.style.borderColor = 'var(--warning)';
        fMsg.style.color = 'var(--warning)';
        fMsg.innerText = state.lang === 'de' ? 'ZEIT ABGELAUFEN!' : 'TIME EXPIRED!';
      }
    }

    if (fScreen) fScreen.classList.add('active');
    setTimeout(() => {
      if (fScreen) fScreen.classList.remove('active');
      state.isProcessing = false;
      const config = getGameModeConfig(state.mode);
      const isMaxQuestionsReached = config.maxQuestions && state.current >= config.maxQuestions - 1;
      if (state.lives <= 0 || isMaxQuestionsReached) {
        const startScreen = document.getElementById('start-screen');
        const gameScreen = document.getElementById('game-screen');
        if (startScreen) startScreen.classList.add('active');
        if (gameScreen) gameScreen.classList.remove('active');
        endGame();
      } else {
        state.current++;
        renderQuestion();
      }
    }, 3500);
  } catch {
    console.error('Handle answer failed');
    state.isProcessing = false;
    endGame();
  }
}

setInterval(() => {
  try {
    const startScreen = document.getElementById('start-screen');
    if (startScreen && startScreen.classList.contains('active')) {
      const eye = document.getElementById('core-eye');
      if (eye) {
        eye.src = './assets/images/ack_splash_void.png';
        setTimeout(() => {
          if (eye) eye.src = './assets/images/ack_core_brain.png';
        }, 150);
      }
    }
  } catch {
    /* Silent catch intentional for non-critical UI operations */
  }
}, 4000);

document.addEventListener('keydown', (e) => {
  try {
    if (state.isPaused) {
      if (!['Enter', ' ', 'Tab', 'Escape'].includes(e.key)) {
        state.cheatsAttempted = true;
        return;
      }
    }
    if (state.isProcessing) return;
    const gameScreen = document.getElementById('game-screen');
    if (gameScreen && !gameScreen.classList.contains('active')) return;
    const map = { 1: 0, 2: 1, 3: 2, 4: 3 };
    if (map[e.key] !== undefined) {
      const container = document.getElementById('options-container');
      if (container) {
        const btns = container.querySelectorAll('.option-btn');
        if (btns[map[e.key]]) btns[map[e.key]].click();
      }
    }
  } catch {
    /* Silent catch intentional for non-critical UI operations */
  }
});

document.addEventListener('contextmenu', (e) => {
  try {
    if (state.isPaused) {
      e.preventDefault();
      state.cheatsAttempted = true;
    }
  } catch {
    /* Silent catch intentional for non-critical UI operations */
  }
});

async function fetchLeaderboard() {
  try {
    const res = await fetch(`${API_BASE_URL}/leaderboard/top?limit=10`);
    if (res.ok) {
      const data = await res.json();
      displayLeaderboard(data);
    }
  } catch {
    console.log('Leaderboard fetch failed');
  }
}

function displayLeaderboard(scores) {
  try {
    let lb =
      '<div style="font-size: 0.8rem; text-align: left; margin-top: 10px; max-height: 200px; overflow-y: auto;">';
    scores.forEach((entry, idx) => {
      lb += `<div>${idx + 1}. ${entry.playerName}: ${entry.score}pts</div>`;
    });
    lb += '</div>';
    const text = document.getElementById('modal-text');
    if (text) text.innerHTML += lb;
  } catch {
    /* Silent catch intentional for non-critical UI operations */
  }
}

function closeSystem() {
  try {
    const modalOverlay = document.getElementById('modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const gameScreen = document.getElementById('game-screen');
    const startScreen = document.getElementById('start-screen');
    const livesDisplay = document.getElementById('lives-display');
    const highScore = document.getElementById('high-score');
    const hudScore = document.getElementById('hud-score');
    const hudStreak = document.getElementById('hud-streak');

    if (modalOverlay) modalOverlay.style.display = 'none';
    if (modalTitle) modalTitle.style.color = 'var(--warning)';
    if (gameScreen) gameScreen.classList.remove('active');
    if (startScreen) startScreen.classList.add('active');

    state.isChallenge = false;
    state.isCreatingChallenge = false;
    state.streak = 0;
    state.streakMax = 0;
    state.correctAnswers = 0;
    state.lives = 3;

    if (livesDisplay) livesDisplay.innerText = state.lives;
    if (highScore) highScore.innerText = state.best;
    if (hudScore) hudScore.innerText = '0_PTS';
    if (hudStreak) hudStreak.style.display = 'none';
    fetchLeaderboard();
  } catch {
    console.error('Close system failed');
  }
}

let resumeInProgress = false;
let visibilityTimeout = null;

document.addEventListener('visibilitychange', () => {
  try {
    if (visibilityTimeout) clearTimeout(visibilityTimeout);

    visibilityTimeout = setTimeout(() => {
      if (document.hidden) {
        const gameScreen = document.getElementById('game-screen');
        if (gameScreen && gameScreen.classList.contains('active') && !state.isPaused) {
          pauseProtocol();
        }
        saveSession();
      } else {
        if (resumeInProgress) return;
        resumeInProgress = true;
        const gameScreen = document.getElementById('game-screen');
        if (
          state.sessionActive &&
          !state.isPaused &&
          gameScreen &&
          gameScreen.classList.contains('active')
        ) {
          if (!state.timerInterval) startTimer();
        }
        setTimeout(() => {
          resumeInProgress = false;
        }, 500);
      }
    }, 250);
  } catch {
    /* Silent catch intentional for non-critical UI operations */
  }
});

window.addEventListener('beforeunload', saveSession);
window.addEventListener('load', restoreSession);

if ('serviceWorker' in navigator) {
  try {
    const swChannel = new BroadcastChannel('sw_channel');
    let leaderTab = false;

    const acquireLeaderLock = () => {
      try {
        const now = Date.now();
        const lock = localStorage.getItem('sw_leader');
        if (!lock || now - JSON.parse(lock).ts > 5000) {
          localStorage.setItem('sw_leader', JSON.stringify({ id: state.playerId, ts: now }));
          leaderTab = true;
          return true;
        }
        return JSON.parse(lock).id === state.playerId;
      } catch {
        return false;
      }
    };

    setInterval(() => {
      if (leaderTab) {
        try {
          localStorage.setItem('sw_leader', JSON.stringify({ id: state.playerId, ts: Date.now() }));
        } catch {
    /* Silent catch intentional for non-critical UI operations */
  }
      }
    }, 2000);

    window.addEventListener('beforeunload', () => {
      if (leaderTab) {
        try {
          localStorage.removeItem('sw_leader');
        } catch {
    /* Silent catch intentional for non-critical UI operations */
  }
      }
    });

    swChannel.onmessage = (event) => {
      if (event.data.type === 'SW_RELOAD') {
        window.location.reload();
      }
    };

    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('./sw.js')
        .then((reg) => {
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            swChannel.postMessage({ type: 'SW_UPDATING' });
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                swChannel.postMessage({ type: 'SW_READY' });
                if (acquireLeaderLock()) {
                  swChannel.postMessage({ type: 'SW_RELOAD' });
                  setTimeout(() => window.location.reload(), 100);
                }
              }
            });
          });
        })
        .catch((err) => console.error('SW registration failed:', err));
    });
  } catch {
    console.error('Service Worker logic failed');
  }
}

let currentLeaderboardMode = 'classic';

async function loadLeaderboardData(mode) {
  const entriesDiv = document.getElementById('leaderboard-entries');
  if (entriesDiv)
    entriesDiv.innerHTML = '<div style="padding:20px;text-align:center;">CONNECTING...</div>';

  try {
    const data = await APIClient.fetchLeaderboard(API_BASE_URL, 20, mode);
    UIManager.renderLeaderboard(entriesDiv, data);
  } catch {
    if (entriesDiv)
      entriesDiv.innerHTML =
        '<div style="padding:20px;text-align:center;color:var(--error);">SERVER_UNAVAILABLE</div>';
  }
}

async function showLeaderboard() {
  try {
    UIManager.toggleClass('battle-lobby', 'active', false);
    UIManager.toggleClass('leaderboard-screen', 'active', true);

    // Reset filter UI
    const filters = document.querySelectorAll('#leaderboard-filters .mode-btn');
    filters.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === 'classic');
    });
    currentLeaderboardMode = 'classic';

    await loadLeaderboardData('classic');
  } catch {
    console.error('Show results failed');
  }
}

function hideLeaderboard() {
  try {
    const screen = document.getElementById('leaderboard-screen');
    const lobby = document.getElementById('battle-lobby');
    if (screen) screen.classList.remove('active');
    if (lobby) lobby.classList.add('active');
  } catch {
    /* Silent catch intentional for non-critical UI operations */
  }
}

// Event Listener Registration
document.addEventListener('DOMContentLoaded', () => {
  const addClick = (id, fn) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', fn);
  };

  addClick('start-btn', () => initGame(false));
  addClick('resume-btn', resumeProtocol);
  addClick('pause-btn', pauseProtocol);
  addClick('show-lobby-btn', showLobby);
  addClick('hide-lobby-btn', hideLobby);
  addClick('show-leaderboard-btn', showLeaderboard);
  addClick('hide-leaderboard-btn', hideLeaderboard);

  // Performance Reporting
  if ('performance' in window && 'PerformanceObserver' in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.name === 'first-contentful-paint') {
            APIClient.reportMetric(API_BASE_URL, 'FCP', entry.startTime);
          }
        });
      });
      observer.observe({ type: 'paint', buffered: true });

      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        APIClient.reportMetric(API_BASE_URL, 'LCP', lastEntry.startTime);
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {
      /* Performance monitoring non-critical */
    }
  }

  // Leaderboard filter event listeners
  const filterBtns = document.querySelectorAll('#leaderboard-filters .mode-btn');
  filterBtns.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const mode = btn.dataset.mode;
      if (mode === currentLeaderboardMode) return;

      filterBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentLeaderboardMode = mode;

      await loadLeaderboardData(mode);
    });
  });
  addClick('start-challenge-btn', startChallenge);
  addClick('close-system-btn', closeSystem);
});

// Debug Exports for Functionality Testing
window.__STATE__ = state;
window.__END_GAME__ = endGame;

window.generateChallengeCode = generateChallengeCode;

// Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((reg) => {
        console.log('SW registered:', reg);
      })
      .catch((err) => {
        console.warn('SW registration failed:', err);
      });
  });
}
