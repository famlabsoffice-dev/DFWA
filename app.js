/**
 * DFWA - Core Application Logic
 *
 * FIX (K1/K2): app.js importiert jetzt tatsächlich alle scripts/*.js Module
 * (vorher: 8 fertige Module lagen im Repo, aber app.js kannte nur 4 Button-IDs
 * und keinerlei Import). Und importiert style.css direkt, damit Vite es korrekt
 * bündelt statt eines veralteten, hart verlinkten CSS-Bundles in index.html.
 * Siehe FEHLERLISTE.md für den vollständigen Bug-Katalog.
 */
import './style.css';
import { UIManager } from './scripts/ui-manager.js';
import { GameModes, ModeConfig, getGameModeConfig } from './scripts/game-modes.js';
import { AchievementManager } from './scripts/achievement-manager.js';
import { AudioManager } from './scripts/audio-manager.js';
import { StorageManager } from './scripts/storage.js';
import { BattleManager } from './scripts/battle-manager.js';
import { GameLogic } from './scripts/game-logic.js';
import { APIClient } from './scripts/api-client.js';

const API_BASE =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : window.location.origin;

// -----------------------------------------------------------------------
// STATE
// -----------------------------------------------------------------------
const state = {
  lang: navigator.language.startsWith('de') ? 'de' : 'de', // Projekt ist primär DE
  systemToken: 'LOCAL_ONLY_UNTRUSTED', // wird durch /config/secret ersetzt (K4)
  questions: [],
  comments: {},
  usedComments: { correct: [], incorrect: [] },
  currentQuestionIndex: 0,
  selectedCategory: null,
  availableCategories: [],
  mode: localStorage.getItem('dfwa_mode') || 'classic',
  players: JSON.parse(localStorage.getItem('dfwa_players') || '[]'),
  playerName: localStorage.getItem('dfwa_name') || 'GUEST',
  playerId: localStorage.getItem('dfwa_id') || String(Math.floor(1000 + Math.random() * 9000)),
  score: 0,
  lives: 3,
  streak: 0,
  streakMax: 0,
  correctAnswers: 0,
  questionCount: 0,
  timer: 15,
  timerEndTimestamp: null,
  timerInterval: null,
  best: parseInt(localStorage.getItem('dfwa_best') || '0', 10),
  wins: parseInt(localStorage.getItem('dfwa_wins') || '0', 10),
  losses: parseInt(localStorage.getItem('dfwa_losses') || '0', 10),
  achievements: JSON.parse(localStorage.getItem('dfwa_achievements') || '[]'),
  isPaused: false,
  isProcessing: false,
  isChallenge: false,
  isCreatingChallenge: false,
  challengeSeed: null,
  opponentScore: 0,
  pausedTimer: null,
  cheatsAttempted: false,
  sessionActive: false,
  isSubmitting: false,
  variant: localStorage.getItem('dfwa_variant') || (Math.random() < 0.5 ? 'A' : 'B'),
  currentLeaderboardMode: 'classic',
};
localStorage.setItem('dfwa_variant', state.variant);
localStorage.setItem('dfwa_id', state.playerId);

// -----------------------------------------------------------------------
// SIGNIERTES LOCALSTORAGE (Integritätsschutz gegen simples Score-Editing)
// -----------------------------------------------------------------------
async function saveSecure(key, value) {
  await StorageManager.saveSecure(key, String(value), state.systemToken);
}
async function checkIntegrity() {
  await StorageManager.validateIntegrity(
    ['dfwa_best', 'dfwa_wins', 'dfwa_losses', 'dfwa_name', 'dfwa_achievements'],
    state.systemToken,
    (key) => {
      if (key === 'dfwa_best') state.best = 0;
      if (key === 'dfwa_wins') state.wins = 0;
      if (key === 'dfwa_losses') state.losses = 0;
      if (key === 'dfwa_name') state.playerName = 'GUEST';
      if (key === 'dfwa_achievements') state.achievements = [];
    }
  );
}

// -----------------------------------------------------------------------
// INIT
// -----------------------------------------------------------------------
async function init() {
  initPWAUpdate();

  // K4 Fix: Client-Token holen (nicht mehr der rohe SYSTEM_SECRET)
  try {
    const res = await fetch(`${API_BASE}/config/secret`);
    state.systemToken = res.ok ? (await res.json()).secret : 'LOCAL_ONLY_UNTRUSTED';
  } catch {
    state.systemToken = 'LOCAL_ONLY_UNTRUSTED';
  }
  await checkIntegrity();

  AudioManager.init();
  updateNameDisplay();
  renderModeSelector();
  await loadQuestions();
  renderPlayerTags();
  updateStartButtonState();
  bindStaticButtons();
  bindLeaderboardFilters();

  document.getElementById('high-score').textContent = state.best;
  document.getElementById('battle-stats').textContent = `W:${state.wins} / L:${state.losses}`;

  // Cross-reload Session-Resume (falls Tab/Browser mitten im Spiel geschlossen wurde)
  await tryResumeSession();

  window.addEventListener('beforeunload', persistSession);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      persistSession();
    }
  });

  // Cheat-Schutz: Tastatureingaben und Rechtsklick während Pause blockieren
  document.addEventListener('keydown', (e) => {
    if (state.isPaused && !['Enter', ' ', 'Tab', 'Escape'].includes(e.key)) {
      state.cheatsAttempted = true;
      return;
    }
    if (state.isProcessing) return;
    const gameScreen = document.getElementById('game-screen');
    if (!gameScreen || !gameScreen.classList.contains('active')) return;
    const map = { 1: 0, 2: 1, 3: 2, 4: 3 };
    if (map[e.key] !== undefined) {
      const btns = document.querySelectorAll('#options-container .option-btn');
      if (btns[map[e.key]]) btns[map[e.key]].click();
    }
  });
  document.addEventListener('contextmenu', (e) => {
    if (state.isPaused) {
      e.preventDefault();
      state.cheatsAttempted = true;
    }
  });
}

function initPWAUpdate() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      const banner = document.createElement('div');
      banner.style.cssText =
        'position:fixed;top:0;left:0;width:100%;background:var(--neon);color:#000;padding:10px;text-align:center;font-weight:bold;z-index:9999;';
      banner.textContent = 'UPDATING_CORE_SYSTEM...';
      document.body.appendChild(banner);
      setTimeout(() => window.location.reload(), 1500);
    });
  }
}

// -----------------------------------------------------------------------
// DATEN LADEN
// -----------------------------------------------------------------------
async function loadQuestions() {
  try {
    if (!window._dfwaQCache) {
      const res = await fetch('./questions_i18n.json');
      if (!res.ok) throw new Error('FETCH_FAILED');
      window._dfwaQCache = await res.json();
    }
    const all = window._dfwaQCache;
    state.availableCategories = [...new Set(all.map((q) => q.cat))];
    if (!state.selectedCategory && state.availableCategories.length > 0) {
      state.selectedCategory = state.availableCategories[0];
    }
    updateCategoryDisplay();
  } catch (e) {
    console.error('Failed to load questions:', e);
  }
}

async function loadComments() {
  try {
    const res = await fetch('./ack_comments.json');
    if (!res.ok) throw new Error('FETCH_FAILED');
    state.comments = await res.json();
  } catch {
    state.comments = { de: { correct: ['CORRECT'], incorrect: ['INCORRECT'] } };
  }
}

// -----------------------------------------------------------------------
// UI: NAME / SPIELER
// -----------------------------------------------------------------------
function updateNameDisplay() {
  UIManager.setText('player-display', state.playerName);
  UIManager.setText('id-display', state.playerId);
}

function handleAddPlayer() {
  const input = document.getElementById('player-name');
  if (!input) return;
  const name = input.value.trim().toUpperCase();
  if (!name) {
    input.classList.add('error-shake');
    setTimeout(() => input.classList.remove('error-shake'), 500);
    return;
  }
  if (!state.players.includes(name)) {
    state.players.push(name);
    localStorage.setItem('dfwa_players', JSON.stringify(state.players));
  }
  state.playerName = name;
  saveSecure('dfwa_name', state.playerName);
  updateNameDisplay();
  renderPlayerTags();
  updateStartButtonState();
  input.value = '';
  input.placeholder = 'USER_REGISTERED';
  setTimeout(() => {
    input.placeholder = 'ENTER_CODENAME';
  }, 1500);
}

function removePlayer(name) {
  state.players = state.players.filter((p) => p !== name);
  localStorage.setItem('dfwa_players', JSON.stringify(state.players));
  if (state.playerName === name) {
    state.playerName = state.players[0] || 'GUEST';
    updateNameDisplay();
  }
  renderPlayerTags();
  updateStartButtonState();
}

function renderPlayerTags() {
  const container = document.getElementById('player-list-container');
  if (!container) return;
  container.replaceChildren();
  state.players.forEach((name) => {
    const tag = document.createElement('div');
    tag.className = 'player-tag';
    if (name === state.playerName) tag.classList.add('active');
    const span = document.createElement('span');
    span.textContent = name;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '×';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      removePlayer(name);
    });
    span.addEventListener('click', () => {
      state.playerName = name;
      updateNameDisplay();
      renderPlayerTags();
    });
    tag.append(span, btn);
    container.appendChild(tag);
  });
}

function updateStartButtonState() {
  const btn = document.getElementById('start-btn');
  if (!btn) return;
  const ready = (state.players.length > 0 || state.playerName !== 'GUEST') && state.selectedCategory;
  btn.style.opacity = ready ? '1' : '0.6';
}

// -----------------------------------------------------------------------
// UI: MODUS-AUSWAHL (K6 Fix: Anzeige über ModeConfig.name, nie key.toUpperCase())
// -----------------------------------------------------------------------
function renderModeSelector() {
  const container = document.getElementById('mode-selector');
  if (!container) return;
  container.replaceChildren();
  Object.entries(ModeConfig).forEach(([key, cfg]) => {
    const btn = document.createElement('button');
    btn.className = 'mode-btn' + (state.mode === key ? ' active' : '');
    btn.dataset.mode = key;
    btn.innerHTML = `<strong>${cfg.name}</strong><small>${cfg.description}</small>`;
    btn.addEventListener('click', () => {
      state.mode = Object.values(GameModes).includes(key) ? key : GameModes.CLASSIC;
      localStorage.setItem('dfwa_mode', state.mode);
      renderModeSelector();
    });
    container.appendChild(btn);
  });
}

function modeDisplayName(mode) {
  const cfg = getGameModeConfig(mode);
  return cfg.name.toUpperCase().replace(/ /g, '_');
}

// -----------------------------------------------------------------------
// UI: KATEGORIE-MODAL
// -----------------------------------------------------------------------
function updateCategoryDisplay() {
  const display = document.getElementById('current-category-display');
  if (display && state.selectedCategory) display.textContent = state.selectedCategory.toUpperCase();
}

function showCategoryModal() {
  const overlay = document.getElementById('modal-overlay');
  const title = document.getElementById('modal-title');
  const text = document.getElementById('modal-text');
  const list = document.getElementById('category-modal-list');
  const shareBtn = document.getElementById('share-btn');
  if (!overlay || !list) return;

  title.textContent = 'SELECT_OPERATIONAL_REALM';
  title.style.color = 'var(--cyber-blue)';
  text.textContent = 'Choose your data sector:';
  if (shareBtn) shareBtn.style.display = 'none';
  list.style.display = 'grid';
  list.replaceChildren();

  state.availableCategories.forEach((cat) => {
    const btn = document.createElement('button');
    btn.className = 'mode-btn' + (cat === state.selectedCategory ? ' active' : '');
    btn.innerHTML = `<strong>${cat.toUpperCase()}</strong><small>DATA_SECTOR_${cat.slice(0, 3).toUpperCase()}</small>`;
    btn.addEventListener('click', () => {
      state.selectedCategory = cat;
      updateCategoryDisplay();
      updateStartButtonState();
      overlay.style.display = 'none';
      if ('vibrate' in navigator) navigator.vibrate(20);
    });
    list.appendChild(btn);
  });
  overlay.style.display = 'flex';
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  const list = document.getElementById('category-modal-list');
  if (overlay) overlay.style.display = 'none';
  if (list) list.style.display = 'none';
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  document.getElementById('start-screen').classList.add('active');
}

// -----------------------------------------------------------------------
// SESSION PERSISTENCE (Pause / Reload)
// -----------------------------------------------------------------------
function persistSession() {
  if (!state.sessionActive) return;
  const snapshot = {
    version: 1,
    current: state.currentQuestionIndex,
    score: state.score,
    lives: state.lives,
    streak: state.streak,
    streakMax: state.streakMax,
    correctAnswers: state.correctAnswers,
    questionCount: state.questionCount,
    selectedCategory: state.selectedCategory,
    mode: state.mode,
    timerEndTimestamp: state.timerInterval ? state.timerEndTimestamp : null,
    timer: state.timer,
  };
  saveSecure('dfwa_session', JSON.stringify(snapshot));
}

function clearSession() {
  state.sessionActive = false;
  localStorage.removeItem('dfwa_session');
  localStorage.removeItem('dfwa_session_sig');
}

async function tryResumeSession() {
  try {
    const raw = localStorage.getItem('dfwa_session');
    const sig = localStorage.getItem('dfwa_session_sig');
    if (!raw || !sig) return;
    const expected = await StorageManager.getSignature(raw, state.systemToken);
    if (sig !== expected) {
      clearSession();
      return;
    }
    const snap = JSON.parse(raw);
    if (snap.version !== 1) {
      clearSession();
      return;
    }
    const remaining = snap.timerEndTimestamp ? (snap.timerEndTimestamp - Date.now()) / 1000 : snap.timer;
    if (snap.lives <= 0 || remaining <= 0) {
      clearSession();
      return;
    }
    Object.assign(state, {
      currentQuestionIndex: snap.current,
      score: snap.score,
      lives: snap.lives,
      streak: snap.streak,
      streakMax: snap.streakMax,
      correctAnswers: snap.correctAnswers,
      questionCount: snap.questionCount,
      selectedCategory: snap.selectedCategory,
      mode: snap.mode,
      timer: Math.max(0, remaining),
    });
    state.sessionActive = true;
    await loadComments();
    const all = window._dfwaQCache || (await fetch('./questions_i18n.json').then((r) => r.json()));
    window._dfwaQCache = all;
    state.questions = all.filter((q) => q.cat === state.selectedCategory);
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    document.getElementById('game-screen').classList.add('active');
    document.getElementById('hud-mode').textContent = modeDisplayName(state.mode);
    showQuestion(true);
  } catch {
    clearSession();
  }
}

// -----------------------------------------------------------------------
// SPIEL: START / PAUSE / RESUME
// -----------------------------------------------------------------------
async function startGame() {
  if (!window._dfwaQCache) await loadQuestions();
  await loadComments();

  const cfg = getGameModeConfig(state.mode);
  Object.assign(state, {
    currentQuestionIndex: 0,
    score: 0,
    lives: cfg.initialLives,
    streak: 0,
    streakMax: 0,
    correctAnswers: 0,
    questionCount: 0,
    isChallenge: state.isChallenge, // ggf. von Challenge-Flow gesetzt
    isPaused: false,
    cheatsAttempted: false,
    pausedTimer: null,
    sessionActive: true,
    timer: cfg.initialTimer,
  });
  state.usedComments = { correct: [], incorrect: [] };

  let pool = window._dfwaQCache || [];
  if (state.selectedCategory) pool = pool.filter((q) => q.cat === state.selectedCategory);
  if (pool.length === 0) pool = (window._dfwaQCache || []).slice(0, 20);

  state.questions = GameLogic.shuffle([...pool], state.isChallenge ? state.challengeSeed : null);
  if (cfg.maxQuestions) state.questions = state.questions.slice(0, cfg.maxQuestions);

  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  document.getElementById('game-screen').classList.add('active');

  document.getElementById('hud-score').textContent = '0_PTS';
  document.getElementById('hud-mode').textContent = modeDisplayName(state.mode);
  const streakEl = document.getElementById('hud-streak');
  if (streakEl) streakEl.style.display = 'none';
  document.getElementById('lives-display').textContent = state.lives;
  const resumeBtn = document.getElementById('resume-btn');
  if (resumeBtn) resumeBtn.style.display = 'none';
  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.style.display = 'none';

  showQuestion(false);
  persistSession();
}

function pauseGame() {
  state.isPaused = true;
  state.cheatsAttempted = false;
  state.pausedTimer = state.timer;
  state.timerEndTimestamp = null;
  clearInterval(state.timerInterval);
  document.getElementById('game-screen').classList.remove('active');
  document.getElementById('start-screen').classList.add('active');
  const resumeBtn = document.getElementById('resume-btn');
  if (resumeBtn) resumeBtn.style.display = 'block';
  persistSession();
}

function resumeGame() {
  const resumeBtn = document.getElementById('resume-btn');
  if (state.cheatsAttempted) {
    if (resumeBtn) {
      resumeBtn.textContent = 'CHEAT_DETECTED';
      setTimeout(() => {
        resumeBtn.textContent = 'RESUME_PROTOCOL';
      }, 1500);
    }
    return;
  }
  state.isPaused = false;
  document.getElementById('start-screen').classList.remove('active');
  document.getElementById('game-screen').classList.add('active');
  if (resumeBtn) resumeBtn.style.display = 'none';
  const cfg = getGameModeConfig(state.mode);
  state.timer = state.pausedTimer && state.pausedTimer > 0 ? state.pausedTimer : cfg.initialTimer;
  state.pausedTimer = null;
  state.timerEndTimestamp = Date.now() + state.timer * 1000;
  startTimerLoop();
  persistSession();
}

// -----------------------------------------------------------------------
// FRAGE-FLUSS
// -----------------------------------------------------------------------
function showQuestion(isResume = false) {
  if (state.lives <= 0) return endGame();
  const q = state.questions[state.currentQuestionIndex];
  if (!q) return endGame();

  UIManager.setText('cat-display', `[${(q.cat || '').toUpperCase()}]`);
  const questionEl = document.getElementById('question-text');
  if (questionEl) questionEl.textContent = q.text[state.lang] || q.text.de || q.text;

  const optionsContainer = document.getElementById('options-container');
  if (optionsContainer) {
    optionsContainer.replaceChildren();
    const opts = q.options[state.lang] || q.options.de || q.options;
    opts.forEach((opt, index) => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.textContent = opt;
      // K8 Fix: nur EIN click-Listener, kein doppeltes pointerup+click Binding.
      btn.addEventListener('click', () => {
        AudioManager.play('click');
        handleAnswer(index === q.correct);
      });
      optionsContainer.appendChild(btn);
    });
  }

  if (!isResume) {
    const cfg = getGameModeConfig(state.mode);
    state.timer = cfg.initialTimer;
    state.timerEndTimestamp = Date.now() + state.timer * 1000;
  }
  startTimerLoop();
}

function startTimerLoop() {
  clearInterval(state.timerInterval);
  const bar = document.getElementById('timer-bar');
  const text = document.getElementById('timer-text');
  const container = document.getElementById('timeline-container');
  const cfg = getGameModeConfig(state.mode);
  if (container) container.setAttribute('aria-valuemax', String(cfg.initialTimer));

  state.timerInterval = setInterval(() => {
    if (state.isPaused) return;
    state.timer = Math.max(0, (state.timerEndTimestamp - Date.now()) / 1000);
    // K3 Fix: #timer-bar wird jetzt korrekt per ID von style.css gestylt;
    // Breite wird relativ zur initialTimer des aktiven Modus berechnet (nicht hartkodiert).
    if (bar) bar.style.width = `${(state.timer / cfg.initialTimer) * 100}%`;
    if (text) text.textContent = `${Math.ceil(state.timer)}S`;
    if (container) container.setAttribute('aria-valuenow', String(Math.ceil(state.timer)));
    if (state.timer <= 0) {
      clearInterval(state.timerInterval);
      handleAnswer(null); // Zeit abgelaufen
    }
  }, 50);
}

function handleAnswer(isCorrectOrNull) {
  if (state.isProcessing) return;
  state.isProcessing = true;
  clearInterval(state.timerInterval);
  state.questionCount++;
  persistSession();

  const feedbackScreen = document.getElementById('feedback-screen');
  const eyeBase = document.getElementById('feedback-eye-base');
  const msg = document.getElementById('feedback-msg');

  if (isCorrectOrNull === true) {
    state.streak++;
    state.correctAnswers++;
    if (state.streak > state.streakMax) state.streakMax = state.streak;
    BattleManager.sendAction({ type: 'CORRECT_ANSWER', streak: state.streak });
    BattleManager.syncState({ score: state.score, streak: state.streak });

    const streakBonus = Math.min((state.streak - 1) * 10, 100);
    const timeBonus = Math.min(Math.floor(state.timer * 2), 30);
    state.score += Math.floor((100 + streakBonus + timeBonus) * getGameModeConfig(state.mode).scoreMultiplier);
    document.getElementById('hud-score').textContent = `${state.score}_PTS`;

    const streakEl = document.getElementById('hud-streak');
    if (streakEl) {
      if (state.streak >= 2) {
        streakEl.style.display = 'inline';
        document.getElementById('hud-streak-count').textContent = state.streak;
      } else {
        streakEl.style.display = 'none';
      }
    }
    if (eyeBase) eyeBase.src = './assets/images/ack_reaction_set.webp';
    if (msg) {
      msg.style.borderColor = 'var(--neon)';
      msg.style.color = 'var(--neon)';
      msg.textContent = pickComment('correct');
    }
    checkAchievements();
    if ('vibrate' in navigator) navigator.vibrate(50);
  } else {
    state.lives = Math.max(0, state.lives - 1);
    state.streak = 0;
    const streakEl = document.getElementById('hud-streak');
    if (streakEl) streakEl.style.display = 'none';
    document.getElementById('lives-display').textContent = state.lives;
    if (eyeBase) eyeBase.src = isCorrectOrNull === false
      ? './assets/images/ack_interference_glitch.webp'
      : './assets/images/ack_core_brain.webp';
    if (msg) {
      msg.style.borderColor = isCorrectOrNull === false ? 'var(--error)' : 'var(--warning)';
      msg.style.color = isCorrectOrNull === false ? 'var(--error)' : 'var(--warning)';
      msg.textContent = isCorrectOrNull === false ? pickComment('incorrect') : 'ZEIT ABGELAUFEN!';
    }
    if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
  }

  if (feedbackScreen) feedbackScreen.classList.add('active');

  setTimeout(() => {
    if (feedbackScreen) feedbackScreen.classList.remove('active');
    state.isProcessing = false;
    const cfg = getGameModeConfig(state.mode);
    const capped = cfg.maxQuestions && state.currentQuestionIndex >= cfg.maxQuestions - 1;
    if (state.lives <= 0 || capped) {
      endGame();
    } else {
      state.currentQuestionIndex++;
      showQuestion(false);
    }
  }, 1200);
}

function pickComment(type) {
  try {
    const langKey = state.comments[state.lang] ? state.lang : 'de';
    let pool = state.comments[langKey]?.[type] || [];
    if (pool.length === 0) return type === 'correct' ? 'ACCESS_GRANTED' : 'CONNECTION_LOST';
    let unused = pool.filter((c) => !state.usedComments[type].includes(c));
    if (unused.length === 0) {
      state.usedComments[type] = [];
      unused = pool;
    }
    const pick = unused[Math.floor(Math.random() * unused.length)];
    state.usedComments[type].push(pick);
    return pick;
  } catch {
    return type === 'correct' ? 'ACCESS_GRANTED' : 'CONNECTION_LOST';
  }
}

function checkAchievements() {
  const unlocked = AchievementManager.checkAchievements(
    { score: state.score, streak: state.streak, selectedMode: state.mode },
    state.achievements
  );
  unlocked.forEach((id) => {
    state.achievements.push(id);
    const toast = document.createElement('div');
    toast.className = 'achievement-toast';
    toast.innerHTML = `<strong>ACHIEVEMENT_UNLOCKED</strong><br>${id}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  });
  if (unlocked.length > 0) {
    localStorage.setItem('dfwa_achievements', JSON.stringify(state.achievements));
  }
}

// -----------------------------------------------------------------------
// SPIELENDE
// -----------------------------------------------------------------------
async function endGame() {
  clearSession();
  clearInterval(state.timerInterval);

  const overlay = document.getElementById('modal-overlay');
  const title = document.getElementById('modal-title');
  const text = document.getElementById('modal-text');
  const list = document.getElementById('category-modal-list');
  const shareBtn = document.getElementById('share-btn');
  const isNewBest = state.score > state.best;

  document.getElementById('lives-display').textContent = state.lives;
  if (isNewBest) {
    state.best = state.score;
    await saveSecure('dfwa_best', state.best);
    document.getElementById('high-score').textContent = state.best;
  }

  if (list) list.style.display = 'none';
  if (overlay) overlay.style.display = 'flex';

  if (state.isCreatingChallenge) {
    title.textContent = 'CHALLENGE_CREATED';
    title.style.color = 'var(--warning)';
    text.textContent = 'GENERATING...';
    if (shareBtn) shareBtn.style.display = 'none';
    const code = await GameLogic.generateChallengeCode(
      Math.floor(Math.random() * 1000000),
      state.score,
      state.systemToken
    );
    text.textContent = code;
  } else if (state.isChallenge) {
    const won = state.score > state.opponentScore;
    title.style.color = won ? 'var(--neon)' : 'var(--error)';
    title.textContent = won ? 'VICTORY' : 'DEFEAT';
    text.textContent = `YOUR_SCORE: ${state.score}\nOPPONENT: ${state.opponentScore}`;
    if (won) {
      state.wins++;
      await saveSecure('dfwa_wins', state.wins);
    } else {
      state.losses++;
      await saveSecure('dfwa_losses', state.losses);
    }
    document.getElementById('battle-stats').textContent = `W:${state.wins} / L:${state.losses}`;
    if (shareBtn) shareBtn.style.display = 'none';
  } else {
    title.style.color = isNewBest ? 'var(--warning)' : 'var(--neon)';
    title.textContent = isNewBest ? 'NEW_PEAK_DATA' : 'PROTOCOL_COMPLETE';
    const accuracy = state.questionCount > 0 ? Math.round((state.correctAnswers / state.questionCount) * 100) : 0;
    text.textContent = `FINAL_SCORE: ${state.score}\nPEAK_DATA: ${state.best}\nACCURACY: ${accuracy}%`;
    if (shareBtn) shareBtn.style.display = 'block';
  }

  submitScore();
}

async function submitScore() {
  if (state.isSubmitting) return;
  state.isSubmitting = true;
  try {
    const payload = await GameLogic.generateAuthPayload(
      state.playerId,
      state.score,
      state.wins,
      state.losses,
      state.mode,
      state.systemToken
    );
    await fetch(`${API_BASE}/api/leaderboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        playerName: state.playerName,
        variant: state.variant,
        accuracy: state.questionCount > 0 ? Math.round((state.correctAnswers / state.questionCount) * 100) : 0,
      }),
    });
  } catch {
    // Netzwerkfehler/Server offline duerfen den Spielfluss nicht blockieren.
  } finally {
    state.isSubmitting = false;
  }
}

// -----------------------------------------------------------------------
// BATTLE LOBBY
// -----------------------------------------------------------------------
function showLobby() {
  document.getElementById('start-screen').classList.remove('active');
  document.getElementById('battle-lobby').classList.add('active');
  BattleManager.init(API_BASE, state.playerId, state.playerName);
}

function hideLobby() {
  document.getElementById('battle-lobby').classList.remove('active');
  document.getElementById('start-screen').classList.add('active');
}

async function startChallenge() {
  const input = document.getElementById('challenge-code-input');
  const code = input ? input.value.trim() : '';
  if (code) {
    try {
      const res = await fetch(`${API_BASE}/api/challenge/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const result = await res.json();
      if (!res.ok || !result.valid) throw new Error(result.error || 'INVALID_CODE');
      state.isChallenge = true;
      state.challengeSeed = result.data.seed;
      state.opponentScore = result.data.score;
      await startGame();
    } catch (e) {
      if (input) {
        input.value = '';
        input.placeholder = e.message === 'EXPIRED' ? 'CODE_ABGELAUFEN' : 'UNGUELTIGER_CODE';
        setTimeout(() => {
          input.placeholder = 'ENTER_CHALLENGE_CODE';
        }, 2000);
      }
    }
  } else {
    state.isCreatingChallenge = true;
    await startGame();
  }
}

function liveBattle() {
  UIManager.showModal('LIVE_BATTLE', 'CONNECTING_TO_BATTLE_SYNC...', 'var(--cyber-blue)');
  BattleManager.init(API_BASE, state.playerId, state.playerName);
  BattleManager.joinBattle('global_lobby');
  setTimeout(async () => {
    state.isChallenge = true;
    state.opponentScore = 0;
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.style.display = 'none';
    await startGame();
  }, 1500);
}

// -----------------------------------------------------------------------
// LEADERBOARD
// -----------------------------------------------------------------------
async function showLeaderboard() {
  document.getElementById('battle-lobby').classList.remove('active');
  document.getElementById('leaderboard-screen').classList.add('active');
  document.querySelectorAll('#leaderboard-filters .mode-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.mode === 'classic');
  });
  state.currentLeaderboardMode = 'classic';
  await fetchAndRenderLeaderboard('classic');
}

function hideLeaderboard() {
  document.getElementById('leaderboard-screen').classList.remove('active');
  document.getElementById('battle-lobby').classList.add('active');
  clearInterval(window._seasonInterval);
}

async function fetchAndRenderLeaderboard(mode) {
  const entriesEl = document.getElementById('leaderboard-entries');
  if (entriesEl) entriesEl.innerHTML = '<div style="padding:20px;text-align:center;">CONNECTING...</div>';
  try {
    const res = await fetch(`${API_BASE}/api/leaderboard?limit=20&mode=${mode}`);
    const data = await res.json();
    UIManager.renderLeaderboard(entriesEl, data.entries || data);
    if (data.season) renderSeasonDashboard(data.season);
  } catch {
    if (entriesEl) {
      entriesEl.innerHTML =
        '<div style="padding:20px;text-align:center;color:var(--error);">SERVER_UNAVAILABLE</div>';
    }
  }
}

function renderSeasonDashboard(season) {
  const dash = document.getElementById('season-dashboard');
  const numEl = document.getElementById('season-number');
  const countdownEl = document.getElementById('season-countdown');
  const barEl = document.getElementById('season-progress-bar');
  if (!dash || !season.last_reset_ts) return;
  dash.style.display = 'block';
  if (numEl) numEl.textContent = season.season_number;
  clearInterval(window._seasonInterval);
  const durationMs = 30 * 24 * 60 * 60 * 1000; // SEASON_CONFIG.DURATION_DAYS
  const resetAt = new Date(season.last_reset_ts).getTime() + durationMs;
  window._seasonInterval = setInterval(() => {
    const remaining = resetAt - Date.now();
    if (remaining <= 0) {
      if (countdownEl) countdownEl.textContent = 'RESET_PENDING';
      if (barEl) barEl.style.width = '100%';
      clearInterval(window._seasonInterval);
      return;
    }
    const d = Math.floor(remaining / 86400000);
    const h = Math.floor((remaining % 86400000) / 3600000);
    const m = Math.floor((remaining % 3600000) / 60000);
    const s = Math.floor((remaining % 60000) / 1000);
    if (countdownEl) countdownEl.textContent = `${d}D ${h}H ${m}M ${s}S`;
    if (barEl) barEl.style.width = `${100 - (remaining / durationMs) * 100}%`;
  }, 1000);
}

function bindLeaderboardFilters() {
  const buttons = document.querySelectorAll('#leaderboard-filters .mode-btn');
  buttons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const mode = btn.dataset.mode;
      if (mode === state.currentLeaderboardMode) return;
      buttons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentLeaderboardMode = mode;
      await fetchAndRenderLeaderboard(mode);
    });
  });
}

// -----------------------------------------------------------------------
// SHARE
// -----------------------------------------------------------------------
async function shareResult() {
  const btn = document.getElementById('share-btn');
  if (!btn) return;
  const original = btn.textContent;
  btn.textContent = 'GENERATING...';
  try {
    const res = await fetch(`${API_BASE}/api/social/share-card`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: state.playerId }),
    });
    if (!res.ok) throw new Error('SHARE_CARD_FAILED');
    const blob = await res.blob();
    const file = new File([blob], 'dfwa_achievement.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'DFWA ACHIEVEMENT', text: `Score: ${state.score}` });
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'dfwa_achievement.png';
      a.click();
      URL.revokeObjectURL(url);
    }
  } catch {
    UIManager.showToast('SHARE_UNAVAILABLE', 'error');
  } finally {
    btn.textContent = original;
  }
}

function refreshLobbyStatus() {
  // Bugfix: war zuvor faelschlich an fetchAndRenderLeaderboard() gebunden --
  // das Leaderboard-Screen ist in der Battle Lobby gar nicht sichtbar. Der
  // "⟳"-Button neben LIVE_BATTLE soll Link-Status/RTT der Lobby auffrischen.
  if (BattleManager.socket && BattleManager.socket.connected) {
    BattleManager.lastPingTime = Date.now();
    BattleManager.socket.emit('ping');
  } else if (BattleManager.socket) {
    BattleManager.socket.connect();
  } else {
    BattleManager.init(API_BASE, state.playerId, state.playerName);
  }
}

// -----------------------------------------------------------------------
// EVENT-BINDING (K8 Fix: genau EIN 'click'-Listener pro Button)
// -----------------------------------------------------------------------
function bindStaticButtons() {
  const on = (id, handler) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', handler);
  };

  on('category-modal-btn', showCategoryModal);
  on('add-player-btn', handleAddPlayer);
  on('start-btn', () => startGame());
  on('close-system-btn', closeModal);
  on('resume-btn', resumeGame);
  on('pause-btn', pauseGame);
  on('show-lobby-btn', showLobby);
  on('hide-lobby-btn', hideLobby);
  on('start-challenge-btn', startChallenge);
  on('live-battle-btn', liveBattle);
  on('refresh-lobby-btn', refreshLobbyStatus);
  on('show-leaderboard-btn', showLeaderboard);
  on('hide-leaderboard-btn', hideLeaderboard);
  on('share-btn', shareResult);

  const nameInput = document.getElementById('player-name');
  if (nameInput) {
    nameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleAddPlayer();
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
