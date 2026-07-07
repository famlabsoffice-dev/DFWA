import { APIClient } from './scripts/api-client.js';
import { UIManager } from './ui-manager.js';
import { BattleManager } from './scripts/battle-manager.js';
import { AudioManager } from './scripts/audio-manager.js';
import { MobileDebug } from './scripts/mobile-debug.js';
import {
  GameModes,
  ModeConfig,
  getGameModeConfig,
} from './scripts/game-modes.js';
import { ACHIEVEMENTS as ACHIEV_CONST, STORAGE_KEYS } from './scripts/constants.js';

	MobileDebug.init();

		// ULTIMATIVER UI HEARTBEAT (v2): Erzwingt Header-Sync und repariert DOM-Struktur
		setInterval(() => {
			try {
				const name = state.playerName || localStorage.getItem('dfwa_name') || 'GUEST';
				
				// 1. Suche stat-player Container
				const statPlayer = document.getElementById('stat-player');
				if (statPlayer) {
					// Prüfe ob der Name bereits korrekt drin steht (Regex für Robustheit)
					const currentContent = statPlayer.innerText;
					if (!currentContent.includes(name)) {
						statPlayer.innerHTML = `USER_IDENT//<br><span id="player-display" style="color: var(--neon) !important; font-weight: 900 !important; display: inline !important; visibility: visible !important;">${name}</span>`;
						MobileDebug.logEvent('UI_FIX', `Header forced to: ${name}`);
					}
				} else {
					// FALLBACK: Wenn stat-player fehlt, erstelle ihn neu im eye-bg-container
					const eyeContainer = document.getElementById('eye-bg-container');
					if (eyeContainer) {
						const newStat = document.createElement('div');
						newStat.id = 'stat-player';
						newStat.className = 'stat-overlay';
						newStat.innerHTML = `USER_IDENT//<br><span id="player-display" style="color: var(--neon); font-weight: 900;">${name}</span>`;
						eyeContainer.appendChild(newStat);
						MobileDebug.logEvent('UI_REPAIR', 'stat-player recreated');
					}
				}

				// 2. Alle anderen Instanzen von player-display synchronisieren
				document.querySelectorAll('#player-display').forEach(el => {
					if (el.innerText !== name) el.innerText = name;
				});
			} catch (e) {
				console.error('HEARTBEAT_CRASH:', e);
			}
		}, 500);
	
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
  players: JSON.parse(localStorage.getItem('dfwa_players') || '[]'),
  selectedCategory: null,
  playerId: localStorage.getItem('dfwa_id') || Math.floor(1000 + Math.random() * 9000).toString(),
  best: parseInt(localStorage.getItem('dfwa_best') || 0),
  wins: parseInt(localStorage.getItem('dfwa_wins') || 0),
  losses: parseInt(localStorage.getItem('dfwa_losses') || 0),
  comments: {},
  usedComments: { correct: [], incorrect: [] },
  isPaused: false,
  isProcessing: false,
  timer: 15,
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

// Sabotage Event Listener
window.addEventListener('sabotage_timer', (e) => {
  const { duration } = e.detail;
  state.timer = Math.max(0, state.timer - duration);
  
  const timerDisplay = document.getElementById('timer-display');
  const sabotageOverlay = document.getElementById('sabotage-overlay');

  if (timerDisplay) {
    timerDisplay.style.color = 'var(--error)';
    setTimeout(() => (timerDisplay.style.color = 'var(--neon)'), 1000);
  }

  if (sabotageOverlay) {
    sabotageOverlay.classList.add('sabotage-active');
    setTimeout(() => {
      sabotageOverlay.classList.remove('sabotage-active');
    }, 1500);
  }
});

const SESSION_VERSION = 1;

function saveSession() {
  if (!state.sessionActive) return;

  const lockKey = 'session_write_lock';
  const myLock = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    localStorage.setItem(lockKey, myLock);

    setTimeout(async () => {
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
        const sessionString = JSON.stringify(sessionData);
        localStorage.setItem(tempKey, sessionString);
        localStorage.setItem('dfwa_session', sessionString);
        await saveSecure('dfwa_session', sessionString);
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

    const sig = localStorage.getItem('dfwa_session_sig');
    if (sig) {
      const expected = await getSignature(data);
      if (sig !== expected) {
        console.warn('SESSION_INTEGRITY_FAILURE: Session tampered. Resetting.');
        clearSession();
        return false;
      }
    }

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

async function initializeClientSecurity() {
  // Hinweis: Das System-Secret wird nicht mehr vom Server geladen (Sicherheitsrisiko).
  // Für clientseitige Integrität (LocalStorage-Schutz) wird ein lokaler Fallback genutzt.
  state.systemSecret = 'LOCAL_ONLY_UNTRUSTED';
  
  try {
    await validateStorage();
  } catch {
    console.error('Storage validation failed');
  }
}
initializeClientSecurity();

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
    const keys = [
      'dfwa_best',
      'dfwa_wins',
      'dfwa_losses',
      'dfwa_name',
      'dfwa_id',
      STORAGE_KEYS.ACHIEVEMENTS,
    ];
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
          if (key === 'dfwa_name') state.playerName = 'GUEST';
          if (key === STORAGE_KEYS.ACHIEVEMENTS) state.achievements = [];
        }
      }
    }

    // Server Sync Attempt
    if (state.playerId && state.playerId !== '0000') {
      const remoteProfile = await APIClient.fetchProfile(API_BASE_URL, state.playerId);
      if (remoteProfile) {
        if (remoteProfile.best > state.best) {
          state.best = remoteProfile.best;
          saveSecure('dfwa_best', state.best);
        }
        if (remoteProfile.wins > state.wins) {
          state.wins = remoteProfile.wins;
          saveSecure('dfwa_wins', state.wins);
        }
        if (remoteProfile.losses > state.losses) {
          state.losses = remoteProfile.losses;
          saveSecure('dfwa_losses', state.losses);
        }
        if (remoteProfile.achievements && remoteProfile.achievements.length > state.achievements.length) {
          state.achievements = remoteProfile.achievements;
          saveSecure(STORAGE_KEYS.ACHIEVEMENTS, JSON.stringify(state.achievements));
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

async function syncProfileToServer() {
  if (!state.playerId || state.playerId === '0000') return;
  const profileData = {
    playerId: state.playerId,
    name: state.playerName,
    best: state.best,
    wins: state.wins,
    losses: state.losses,
    achievements: state.achievements
  };
  await APIClient.syncProfile(API_BASE_URL, profileData, state.systemSecret);
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

function preloadGameAssets() {
  const assets = [
    './assets/images/ack_splash_void.webp',
    './assets/images/ack_category_realm.webp',
    './assets/images/ack_hall_of_infamy.webp',
    './assets/images/ack_core_brain.webp',
    './assets/images/ack_override_alien.webp',
    './assets/images/ack_interference_glitch.webp',
    './assets/images/ack_eye_wink.webp',
    './assets/images/ack_player_win_angry.webp',
    './assets/images/ack_eye_skeptical.webp',
    './assets/images/ack_reaction_set.webp'
  ];
  assets.forEach(src => {
    const img = new Image();
    img.src = src;
  });
}
preloadGameAssets();

function applyTheme(themeName) {
  state.theme = themeName;
  localStorage.setItem(STORAGE_KEYS.THEME, themeName);
  document.body.className = themeName === 'default' ? '' : `theme-${themeName}`;
}

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
  const shareBtn = document.createElement('button');
  shareBtn.className = 'option-btn';
  shareBtn.style.fontSize = '0.6rem';
  shareBtn.style.padding = '2px 5px';
  shareBtn.style.marginTop = '5px';
  shareBtn.innerText = 'SHARE';
  shareBtn.onclick = (e) => {
    e.stopPropagation();
    shareAchievement(achievement);
  };
  toast.appendChild(shareBtn);
  
  document.body.appendChild(toast);
  AudioManager.play('achievement');
  setTimeout(() => toast.remove(), 5000);

  sendLocalNotification('ACHIEVEMENT_UNLOCKED', achievement.name);
}

async function shareAchievement(achievement) {
  try {
    const text = state.lang === 'de' 
      ? `Ich habe das Achievement "${achievement.name}" in ACK ATTACK freigeschaltet! Systemstatus: Synchronisiert.` 
      : `I unlocked the "${achievement.name}" achievement in ACK ATTACK! System status: Synced.`;
    
    if (navigator.share) {
      await navigator.share({
        title: 'ACK ATTACK ACHIEVEMENT',
        text: text,
        url: window.location.origin + window.location.pathname
      });
    } else {
      await navigator.clipboard.writeText(text);
      alert(state.lang === 'de' ? 'In Zwischenablage kopiert!' : 'Copied to clipboard!');
    }
  } catch (err) {
    console.error('Sharing achievement failed', err);
  }
}

async function requestNotificationPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
    await Notification.requestPermission();
  }
}

function sendLocalNotification(title, body) {
  if (Notification.permission === 'granted') {
    navigator.serviceWorker.ready.then((registration) => {
      registration.showNotification(title, {
        body: body,
        icon: './assets/icons/icon-192.png',
        badge: './assets/icons/icon-192.png',
        vibrate: [100, 50, 100],
      });
    });
  }
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


async function renderCategorySelector() {
  try {
    const container = document.getElementById('category-modal-list');
    const displayEl = document.getElementById('current-category-display');
    if (!container) return;
    
    let allQuestions = window._dfwaQCache;
    if (!allQuestions) {
      const qRes = await fetch('questions_i18n.json');
      if (!qRes.ok) throw new Error('FETCH_FAILED');
      allQuestions = await qRes.json();
      window._dfwaQCache = allQuestions;
    }
    
    const categories = [...new Set(allQuestions.map(q => q.cat))];
    container.innerHTML = '';
    
    if (categories.length === 0) {
      container.innerHTML = '<p style="color: var(--error); font-size: 0.7rem;">SYSTEM_ERROR: NO_CATEGORIES_FOUND</p>';
      return;
    }
    
    categories.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'mode-btn' + (state.selectedCategory === cat ? ' active' : '');
      btn.innerText = (cat || 'UNKNOWN').toUpperCase();
      const selectCat = (e) => {
        if (e) e.preventDefault();
        MobileDebug.logEvent('SELECT', `Category: ${cat}`);
        state.selectedCategory = cat;
        if (displayEl) displayEl.innerText = cat.toUpperCase();
        closeModal();
        updateStartButtonState();
      };
      btn.addEventListener('pointerdown', selectCat);
      btn.addEventListener('click', selectCat);
      container.appendChild(btn);
    });
  } catch (e) {
    console.error('Render category selector failed:', e);
  }
}

function showCategoryModal() {
  MobileDebug.logEvent('BUTTON', 'Category modal clicked');
  const overlay = document.getElementById('modal-overlay');
  const title = document.getElementById('modal-title');
  const text = document.getElementById('modal-text');
  const list = document.getElementById('category-modal-list');
  const closeBtn = document.getElementById('close-system-btn');
  
  MobileDebug.logEvent('MODAL', `Elements: overlay=${!!overlay} list=${!!list}`);
  
  if (overlay) overlay.style.display = 'flex';
  if (title) title.innerText = state.lang === 'de' ? 'KATEGORIE_WÄHLEN' : 'SELECT_CATEGORY';
  if (text) text.style.display = 'none';
  if (list) {
    list.style.display = 'grid';
    renderCategorySelector();
  }
  if (closeBtn) closeBtn.innerText = state.lang === 'de' ? 'ABBRECHEN' : 'CANCEL';
  MobileDebug.logEvent('MODAL', 'Category modal opened');
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  const list = document.getElementById('category-modal-list');
  const text = document.getElementById('modal-text');
  
  if (overlay) overlay.style.display = 'none';
  if (list) list.style.display = 'none';
  if (text) text.style.display = 'block';
}


function handleAddPlayer() {
  MobileDebug.logEvent('BUTTON', 'Add player clicked');

  try {
    const nameInput = document.getElementById('player-name');
    const name = nameInput ? nameInput.value.trim() : '';
    MobileDebug.logEvent('INPUT', `Player: ${name}`);
    if (!name) return;

    if (!state.players.includes(name)) {
      state.players.push(name);
      state.playerName = name;
      localStorage.setItem('dfwa_players', JSON.stringify(state.players));
      saveSecure('dfwa_name', name);
      
      // RADIKALE UI ERZWUNGUNG (Revision 2)
      console.log('FORCING_UI_UPDATE_FOR:', name);
      
      // 1. Suche ALLE Elemente mit der ID player-display (falls Duplikate existieren)
      const allDisplays = document.querySelectorAll('#player-display');
      allDisplays.forEach(el => {
        el.innerText = name;
        el.style.color = 'var(--neon)';
        el.style.fontWeight = 'bold';
      });

      // 2. Suche das stat-player Container Element
      const statPlayer = document.getElementById('stat-player');
      if (statPlayer) {
        // Ersetze den gesamten Inhalt, um sicherzugehen
        statPlayer.innerHTML = `USER_IDENT//<br><span id="player-display" style="color: var(--neon); font-weight: bold;">${name}</span>`;
      }
      
      // 3. Update globalen Header (falls vorhanden)
      const globalHeader = document.querySelector('header #player-display');
      if (globalHeader) globalHeader.innerText = name;
      
      MobileDebug.logEvent('SAVE', `Player added: ${name}`);
      updatePlayerListUI();
    }
    if (nameInput) nameInput.value = '';
    updateStartButtonState();
  } catch {
    console.error('Add player failed');
  }
}

	function updatePlayerListUI() {
	  const container = document.getElementById('player-list-container');
	  if (!container) return;
	  container.innerHTML = state.players
	    .map(
	      (p) => `
	    <div class="player-tag">
	      <span>${p}</span>
	      <button class="remove-player-btn" data-player="${p}">×</button>
	    </div>`
	    )
	    .join('');
	  
	  // Event Listener für Remove-Buttons hinzufügen (PWA konform)
	  container.querySelectorAll('.remove-player-btn').forEach(btn => {
	    btn.addEventListener('click', (e) => {
	      e.preventDefault();
	      const name = btn.getAttribute('data-player');
	      window.handleRemovePlayer(name);
	    });
	  });
	}

window.handleRemovePlayer = (name) => {
  state.players = state.players.filter((p) => p !== name);
  localStorage.setItem('dfwa_players', JSON.stringify(state.players));
  updatePlayerListUI();
  updateStartButtonState();
};

function updateStartButtonState() {
  const startBtn = document.getElementById('start-btn');
  if (startBtn) {
    const isValid = state.players.length > 0 && state.selectedCategory;
    startBtn.disabled = !isValid;
    startBtn.style.opacity = isValid ? '1' : '0.5';
  }
}

function showLobby() {
  try {
    const startScreen = document.getElementById('start-screen');
    const battleLobby = document.getElementById('battle-lobby');
    if (startScreen) startScreen.classList.remove('active');
    if (battleLobby) battleLobby.classList.add('active');
    renderModeSelector();
    
    // Automatische Initialisierung der Battle-Verbindung für Status-Anzeige
    BattleManager.init(API_BASE_URL, state.playerId, state.playerName);
    BattleManager.joinBattle('global_lobby', state.playerId);
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
    const coreEye = document.getElementById('core-eye');
    
    if (gameScreen) gameScreen.classList.remove('active');
    if (startScreen) startScreen.classList.add('active');
    if (resumeBtn) resumeBtn.style.display = 'block';
    if (coreEye) coreEye.src = './assets/images/ack_pause.webp';
    
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
    const coreEye = document.getElementById('core-eye');
    
    if (startScreen) startScreen.classList.remove('active');
    if (gameScreen) gameScreen.classList.add('active');
    if (resumeBtn) resumeBtn.style.display = 'none';
    if (coreEye) coreEye.src = './assets/images/ack_core_brain.webp';

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
  if (state.isProcessing) return;
  state.isProcessing = true;
  try {
    if (!isRestoring) {
      if (state.players.length > 0) {
        state.playerName = state.players[0];
      } else {
        const nameInput = document.getElementById('player-name');
        state.playerName = nameInput ? nameInput.value.trim() || 'GUEST' : 'GUEST';
      }
      saveSecure('dfwa_name', state.playerName);

      const playerDisplay = document.getElementById('player-display');
      if (playerDisplay) playerDisplay.innerText = state.playerName;
      
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
    } else {
      state.isProcessing = true; // Sicherstellen, dass bei Restore auch gelockt ist
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

      let filteredQuestions = allQuestions;
      if (state.selectedCategory) {
        filteredQuestions = allQuestions.filter(q => q.cat === state.selectedCategory);
      }
      
      state.questions = shuffle([...filteredQuestions], state.isChallenge ? state.challengeSeed : null);
      const config = getGameModeConfig(state.mode);
      if (config.maxQuestions) state.questions = state.questions.slice(0, config.maxQuestions);

      const startScreen = document.getElementById('start-screen');
      const battleLobby = document.getElementById('battle-lobby');
      const gameScreen = document.getElementById('game-screen');
      if (startScreen) startScreen.classList.remove('active');
      if (battleLobby) battleLobby.classList.remove('active');
      if (gameScreen) {
        gameScreen.classList.add('active');
        // Apply Category Realm Visuals
        gameScreen.classList.remove('realm-hardware', 'realm-ai', 'realm-security', 'realm-default');
        const cat = state.selectedCategory ? state.selectedCategory.toLowerCase() : '';
        if (cat.includes('technik') || cat.includes('wissenschaft')) {
          gameScreen.classList.add('realm-hardware');
        } else if (cat.includes('kunst') || cat.includes('literatur') || cat.includes('musik')) {
          gameScreen.classList.add('realm-ai');
        } else if (cat.includes('geschichte') || cat.includes('erdkunde') || cat.includes('gege')) {
          gameScreen.classList.add('realm-security');
        } else {
          gameScreen.classList.add('realm-default');
        }
      }

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
    console.error('Init game failed');
  }
}

function startTimer() {
  try {
    clearInterval(state.timerInterval);
    const bar = document.getElementById('timer-bar');
    if (!bar) return;
    
    state.timerEndTimestamp = Date.now() + state.timer * 1000;
    
    state.timerInterval = setInterval(() => {
      if (state.isPaused) return;
      
      const now = Date.now();
      const remaining = (state.timerEndTimestamp - now) / 1000;
      state.timer = Math.max(0, remaining);
      
      const config = getGameModeConfig(state.mode);
      const total = config.initialTimer;
      const pct = (state.timer / total) * 100;
      bar.style.width = pct + '%';

      if (state.timer <= 3) {
        bar.style.background = 'var(--error)';
      } else {
        bar.style.background = 'var(--neon)';
      }

      if (state.timer <= 0) {
        clearInterval(state.timerInterval);
        checkAnswer(null);
      }
    }, 50);
  } catch {
    console.error('Start timer failed');
  }
}

function renderQuestion(isRestoring = false) {
  try {
    if (!isRestoring) state.current++;
    
    if (state.current >= state.questions.length) {
      endGame();
      return;
    }

    const q = state.questions[state.current];
    const qBox = document.getElementById('question-text');
    if (qBox) qBox.innerText = q.text[state.lang] || q.text['de'];

    const optContainer = document.getElementById('options-container');
    if (optContainer) {
      optContainer.innerHTML = '';
      const opts = q.options[state.lang] || q.options['de'];
      opts.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerText = opt;
        btn.onclick = () => checkAnswer(idx === q.correct);
        optContainer.appendChild(btn);
      });
    }
    
    state.isProcessing = false;
    const config = getGameModeConfig(state.mode);
    
    if (config.isSurvival) {
      const reduction = state.correctAnswers * config.timeReductionPerQuestion;
      state.timer = Math.max(config.minTimer, config.initialTimer - reduction);
    } else {
      state.timer = config.initialTimer;
    }
    
    startTimer();
  } catch {
    console.error('Render question failed');
  }
}

function getComment(type) {
  try {
    const list = state.comments[type] || [];
    if (list.length === 0) return type === 'correct' ? 'CORRECT' : 'INCORRECT';
    
    const unused = list.filter(c => !state.usedComments[type].includes(c));
    const finalPool = unused.length > 0 ? unused : list;
    
    const comment = finalPool[Math.floor(Math.random() * finalPool.length)];
    state.usedComments[type].push(comment);
    if (state.usedComments[type].length > 5) state.usedComments[type].shift();
    
    return comment[state.lang] || comment['de'];
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
      
      BattleManager.sendAction({ type: 'CORRECT_ANSWER', streak: state.streak, score: state.score }, state.playerId);
      
      // Sabotage-Trigger: Alle 5er Streak
      if (state.streak > 0 && state.streak % 5 === 0) {
        BattleManager.sendAction({ type: 'sabotage', sabotageType: 'timer_drain', duration: 3 }, state.playerId);
        UIManager.showToast('SABOTAGE DEPLOYED!', 'warning');
      }

      BattleManager.syncState({ score: state.score, streak: state.streak }, state.playerId);
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
      if (fEyeBase) {
        if (state.streak >= 10) {
          fEyeBase.src = './assets/images/ack_eye_wink.webp';
        } else if (state.streak >= 5) {
          fEyeBase.src = './assets/images/ack_player_win_angry.webp';
        } else {
          fEyeBase.src = './assets/images/ack_reaction_set.webp';
        }
      }
      if (fMsg) {
        fMsg.style.borderColor = 'var(--neon)';
        fMsg.style.color = 'var(--neon)';
        fMsg.innerText = getComment('correct');
      }
      AudioManager.play('correct');
      checkAchievements();
    } else if (correct === false) {
      state.lives = Math.max(0, state.lives - 1);
      state.streak = 0;
      saveSession();
      const hudStreak = document.getElementById('hud-streak');
      if (hudStreak) hudStreak.style.display = 'none';
      const livesDisplay = document.getElementById('lives-display');
      if (livesDisplay) livesDisplay.innerText = state.lives;
      if (fEyeBase) {
        if (state.lives === 1) {
          fEyeBase.src = './assets/images/ack_eye_skeptical.webp';
        } else {
          fEyeBase.src = './assets/images/ack_interference_glitch.webp';
        }
      }
      if (fContainer) fContainer.classList.add('zoom-anim');
      if (fMsg) {
        fMsg.style.borderColor = 'var(--error)';
        fMsg.style.color = 'var(--error)';
        fMsg.innerText = getComment('incorrect');
      }
      AudioManager.play('error');
    } else {
      state.lives = Math.max(0, state.lives - 1);
      state.streak = 0;
      saveSession();
      if (fEyeBase) fEyeBase.src = './assets/images/ack_core_brain.webp';
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
        renderQuestion();
      }
    }, 1500);
  } catch {
    console.error('Check answer failed');
  }
}

async function endGame() {
  try {
    state.sessionActive = false;
    clearInterval(state.timerInterval);
    
    if (state.score > state.best) {
      state.best = state.score;
      saveSecure('dfwa_best', state.best);
      syncProfileToServer();
      syncLeaderboard();
    }
    
    // Apply Game Over Visuals
    const modalContent = document.getElementById('modal-content');
    if (modalContent) {
      modalContent.style.backgroundImage = "url('./assets/images/ack_system_shutdown.webp')";
      modalContent.style.backgroundSize = "cover";
      modalContent.style.backgroundPosition = "center";
    }

    const res = await generateChallengeCode();
    UIManager.showModal(
      state.lang === 'de' ? 'SYSTEM_ABSCHLUSS' : 'SYSTEM_TERMINATED',
      (state.lang === 'de' ? 'DEIN_SCORE: ' : 'YOUR_SCORE: ') + state.score + 
      '<br><br>' + (state.lang === 'de' ? 'CHALLENGE_CODE:' : 'CHALLENGE_CODE:') + 
      '<br><input type="text" class="cyber-input" value="' + res + '" readonly style="font-size: 0.6rem;">',
      'var(--warning)'
    );
    
    const shareBtn = document.createElement('button');
    shareBtn.className = 'option-btn start-btn';
    shareBtn.style.marginTop = '15px';
    shareBtn.innerText = state.lang === 'de' ? 'ERGEBNIS_TEILEN' : 'SHARE_RESULT';
    shareBtn.onclick = () => shareResult(res);
    
    if (modalContent) modalContent.appendChild(shareBtn);
    
    clearSession();
    updateUIForLanguage();
  } catch {
    console.error('End game failed');
  }
}

async function shareResult(challengeCode) {
  try {
    const shareData = {
      title: 'ACK ATTACK SCORE',
      text: state.lang === 'de' 
        ? `Ich habe ${state.score} Punkte in ACK ATTACK erreicht! Kannst du mich schlagen? Code: ${challengeCode}` 
        : `I scored ${state.score} points in ACK ATTACK! Can you beat me? Code: ${challengeCode}`,
      url: window.location.origin + window.location.pathname
    };
    
    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      await navigator.share(shareData);
    } else {
      await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
      UIManager.showToast(state.lang === 'de' ? 'SYSTEM_SYNC: IN_ZWISCHENABLAGE' : 'SYSTEM_SYNC: COPIED_TO_CLIPBOARD', 'success');
    }
  } catch (err) {
    console.error('Sharing failed', err);
    // Fallback for failed share
    const text = state.lang === 'de' 
      ? `Ich habe ${state.score} Punkte in ACK ATTACK erreicht! Code: ${challengeCode}` 
      : `I scored ${state.score} points in ACK ATTACK! Code: ${challengeCode}`;
    await navigator.clipboard.writeText(text);
  }
}

async function syncLeaderboard() {
  try {
    await APIClient.updateLeaderboard(API_BASE_URL, {
      playerId: state.playerId,
      playerName: state.playerName,
      score: state.score,
      wins: state.wins,
      losses: state.losses,
      mode: state.mode
    }, state.systemSecret);
  } catch {
    console.error('Sync leaderboard failed');
  }
}

				const handleStart = (e) => {
					if (e) e.preventDefault();
					MobileDebug.logEvent('BUTTON', 'Start clicked');
					if (state.isProcessing) return;
					
					// Validierung vor Start
					if (state.players.length === 0) {
						const nameInput = document.getElementById('player-name');
						if (nameInput && nameInput.value.trim()) {
							handleAddPlayer();
						} else {
							MobileDebug.logEvent('ERROR', 'No player name');
							return;
						}
					}
					if (!state.selectedCategory) {
						showCategoryModal();
						return;
					}
					
					initGame(false);
				};
				const startBtn = document.getElementById('start-btn');
				if (startBtn) {
					startBtn.addEventListener('pointerdown', handleStart);
					startBtn.addEventListener('click', handleStart);
				}
					// RADIKALER REBUILD: Globale Event-Delegation am Body
					// Dies umgeht Probleme mit verschwundenen/neu gerenderten Buttons
					document.body.addEventListener('click', (e) => {
						const target = e.target.closest('#add-player-btn');
						if (target) {
							e.preventDefault();
							e.stopPropagation();
							MobileDebug.logEvent('DELEGATION', 'Add Player Clicked');
							handleAddPlayer();
						}
					}, true);

					document.body.addEventListener('pointerup', (e) => {
						const target = e.target.closest('#add-player-btn');
						if (target) {
							e.preventDefault();
							e.stopPropagation();
							MobileDebug.logEvent('DELEGATION', 'Add Player PointerUp');
							handleAddPlayer();
						}
					}, true);
		document.getElementById('pause-btn')?.addEventListener('pointerdown', (e) => {
			e.preventDefault();
			pauseProtocol();
		});
		document.getElementById('resume-btn')?.addEventListener('pointerdown', (e) => {
			e.preventDefault();
			resumeProtocol();
		});
		// Korrektur der Button-IDs für Lobby-Steuerung
			const handleLobby = (e) => {
				e.preventDefault();
				showLobby();
			};
			document.getElementById('show-lobby-btn')?.addEventListener('pointerdown', handleLobby);
			document.getElementById('show-lobby-btn')?.addEventListener('click', handleLobby);
		document.getElementById('hide-lobby-btn')?.addEventListener('pointerdown', (e) => {
			e.preventDefault();
			hideLobby();
		});
			const categoryModalBtn = document.getElementById('category-modal-btn');
			if (categoryModalBtn) {
				categoryModalBtn.addEventListener('pointerdown', (e) => {
					e.preventDefault();
					showCategoryModal();
				});
				categoryModalBtn.addEventListener('click', (e) => {
					e.preventDefault();
					showCategoryModal();
				});
			}
		document.getElementById('close-system-btn')?.addEventListener('pointerdown', (e) => {
			e.preventDefault();
			closeModal();
		});
			// Leaderboard Button
			document.getElementById('start-show-leaderboard-btn')?.addEventListener('pointerdown', (e) => {
				e.preventDefault();
				const startScreen = document.getElementById('start-screen');
				const leaderboardScreen = document.getElementById('leaderboard-screen');
				if (startScreen) startScreen.classList.remove('active');
				if (leaderboardScreen) leaderboardScreen.classList.add('active');
			});
			
			// Globales Feedback für alle Buttons
			document.querySelectorAll('.option-btn').forEach(btn => {
				btn.addEventListener('pointerdown', () => {
					btn.classList.add('touch-active');
					if ('vibrate' in navigator) navigator.vibrate(10);
				});
				btn.addEventListener('pointerup', () => btn.classList.remove('touch-active'));
				btn.addEventListener('pointerleave', () => btn.classList.remove('touch-active'));
				btn.addEventListener('pointercancel', () => btn.classList.remove('touch-active'));
			});
		document.getElementById('hide-leaderboard-btn')?.addEventListener('pointerdown', (e) => {
			e.preventDefault();
			const startScreen = document.getElementById('start-screen');
			const leaderboardScreen = document.getElementById('leaderboard-screen');
			if (leaderboardScreen) leaderboardScreen.classList.remove('active');
			if (startScreen) startScreen.classList.add('active');
		});
	
	renderCategorySelector();
	updatePlayerListUI();
	updateStartButtonState();
	renderModeSelector();
	restoreSession();

// PWA Install Lifecycle & Standalone Detection
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  console.log('SYSTEM: PWA_INSTALL_PROMPT_READY');
  // Optional: Hier könnte ein UI-Button für die Installation eingeblendet werden
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  console.log('SYSTEM: PWA_INSTALLED_SUCCESSFULLY');
});

function checkStandaloneMode() {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  if (isStandalone) {
    document.body.classList.add('pwa-standalone');
    console.log('SYSTEM: STANDALONE_MODE_ACTIVE');
  }
}
checkStandaloneMode();
