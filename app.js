import { StorageManager } from './scripts/storage.js';
import { GameLogic } from './scripts/game-logic.js';
import { UIManager } from './scripts/ui-manager.js';
import { APIClient } from './scripts/api-client.js';
import { STORAGE_KEYS, SYSTEM_MESSAGES, GAME_MODES } from './scripts/constants.js';

const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : window.location.origin;

let state = { 
    lang: 'de', questions: [], allQuestions: [], current: 0, score: 0, lives: 3,
    streak: 0, streakMax: 0, correctAnswers: 0,
    playerName: localStorage.getItem(STORAGE_KEYS.PLAYER_NAME) || 'GUEST',
    playerId: localStorage.getItem(STORAGE_KEYS.PLAYER_ID) || Math.floor(1000 + Math.random() * 9000).toString(),
    best: parseInt(localStorage.getItem(STORAGE_KEYS.HIGH_SCORE) || 0),
    wins: parseInt(localStorage.getItem('dfwa_wins') || 0),
    losses: parseInt(localStorage.getItem('dfwa_losses') || 0),
    comments: {}, usedComments: { correct: [], incorrect: [] },
    isPaused: false, isProcessing: false, timer: 15, timerInterval: null, questionCount: 0,
    isChallenge: false, isCreatingChallenge: false, challengeSeed: null, opponentScore: 0,
    systemSecret: null, sessionActive: false, mode: GAME_MODES.CLASSIC,
    variant: localStorage.getItem(STORAGE_KEYS.LAST_VARIANT) || (Math.random() < 0.5 ? 'A' : 'B')
};

// Event Listener Setup
function setupEventListeners() {
    const addClick = (id, fn) => document.getElementById(id)?.addEventListener('click', fn);
    
    addClick('start-btn', () => initGame(false));
    addClick('resume-btn', resumeProtocol);
    addClick('lobby-btn', () => {
        state.playerName = document.getElementById('player-name').value.trim() || 'GUEST';
        StorageManager.saveSecure(STORAGE_KEYS.PLAYER_NAME, state.playerName, state.systemSecret);
        UIManager.toggleClass('start-screen', 'active', false);
        UIManager.toggleClass('battle-lobby', 'active', true);
    });
    addClick('start-challenge-btn', startChallenge);
    addClick('show-leaderboard-btn', showLeaderboard);
    addClick('hide-lobby-btn', () => {
        UIManager.toggleClass('battle-lobby', 'active', false);
        UIManager.toggleClass('start-screen', 'active', true);
    });
    addClick('hide-leaderboard-btn', hideLeaderboard);
    addClick('pause-btn', pauseProtocol);
    addClick('close-system-btn', closeSystem);
}

// Globaler Error Handler
window.onerror = (message, source, lineno, colno, error) => {
    APIClient.reportError(API_BASE_URL, {
        message: message,
        stack: error ? error.stack : `at ${source}:${lineno}:${colno}`,
        userAgent: navigator.userAgent
    });
};

window.onunhandledrejection = (event) => {
    APIClient.reportError(API_BASE_URL, {
        message: `Unhandled Rejection: ${event.reason}`,
        stack: event.reason ? event.reason.stack : null,
        userAgent: navigator.userAgent
    });
};

async function initApp() {
    state.systemSecret = await APIClient.fetchSecret(API_BASE_URL);
    await StorageManager.validateIntegrity([STORAGE_KEYS.HIGH_SCORE, 'dfwa_wins', 'dfwa_losses'], state.systemSecret, (key) => {
        if (key === STORAGE_KEYS.HIGH_SCORE) state.best = 0;
        if (key === 'dfwa_wins') state.wins = 0;
        if (key === 'dfwa_losses') state.losses = 0;
    });
    detectLanguage();
}

function detectLanguage() {
    state.lang = localStorage.getItem('dfwa_lang') || (navigator.language.startsWith('de') ? 'de' : 'en');
    if (!localStorage.getItem(STORAGE_KEYS.PLAYER_ID)) StorageManager.saveSecure(STORAGE_KEYS.PLAYER_ID, state.playerId, state.systemSecret);
    updateUIForLanguage();
}

function updateUIForLanguage() {
    document.documentElement.lang = state.lang;
    UIManager.updateElement('start-btn', state.lang === 'de' ? 'PROTOKOLL_STARTEN' : 'INIT_PROTOCOL');
    UIManager.updateElement('player-display', state.playerName);
    UIManager.updateElement('id-display', state.playerId);
    UIManager.updateElement('high-score', state.best);
    UIManager.updateElement('battle-stats', `W:${state.wins} / L:${state.losses}`);
    const nameInput = document.getElementById('player-name');
    if (nameInput) nameInput.value = state.playerName !== 'GUEST' ? state.playerName : '';
}

async function startChallenge() {
    const code = document.getElementById('challenge-code-input').value.trim();
    if (code) {
        try {
            const data = await APIClient.verifyChallenge(API_BASE_URL, code);
            state.isChallenge = true;
            state.challengeSeed = data.seed;
            state.opponentScore = data.score;
            initGame(false);
        } catch(e) {
            const input = document.getElementById('challenge-code-input');
            input.value = '';
            input.placeholder = e.message === 'EXPIRED' ? 'CODE_EXPIRED' : 'INVALID_CODE';
        }
    } else initGame(true);
}

async function initGame(createChallenge) {
    state.lives = 3; state.current = 0; state.score = 0; state.questionCount = 0; state.streak = 0;
    state.isCreatingChallenge = createChallenge; state.sessionActive = true;
    state.streakMax = 0;
    state.correctAnswers = 0;
    state.isPaused = false;
    state.cheatAttempted = false;
    state.pausedTimer = null;
    state.mode = document.getElementById("mode-selector").value;
    UIManager.updateElement('hud-mode', state.mode.toUpperCase());
    
    UIManager.updateElement('lives-display', state.lives);
    UIManager.toggleClass('start-screen', 'active', false);
    UIManager.toggleClass('battle-lobby', 'active', false);
    UIManager.toggleClass('game-screen', 'active', true);
    
    try {
        const qRes = await fetch("questions_i18n.json");
        state.allQuestions = await qRes.json();
    } catch (error) {
        if (window.APIClient) APIClient.reportError(API_BASE_URL, { type: 'FETCH_QUESTIONS', msg: error.message });
        UIManager.showModal("FEHLER", SYSTEM_MESSAGES.FETCH_QUESTIONS_ERROR, "red");
        return;
    }

    try {
        const cRes = await fetch("ack_comments.json");
        state.comments = await cRes.json();
    } catch (error) {
        if (window.APIClient) APIClient.reportError(API_BASE_URL, { type: 'FETCH_COMMENTS', msg: error.message });
        UIManager.showModal("FEHLER", SYSTEM_MESSAGES.FETCH_COMMENTS_ERROR, "orange");
        state.comments = {}; // Fallback zu leerem Objekt
    }
    
    state.questions = GameLogic.shuffle([...state.allQuestions], state.isChallenge ? state.challengeSeed : null);
    renderQuestion();
    startTimer();
}

function renderQuestion() {
    if (state.mode === GAME_MODES.ENDLESS && state.current >= state.questions.length) {
        state.questions = GameLogic.shuffle([...state.allQuestions]);
        state.current = 0;
    }
    
    if (state.mode === GAME_MODES.BLITZ && state.questionCount >= 20) {
        endGame();
        return;
    }

    if (state.current >= state.questions.length || state.current < 0) {
        if (window.APIClient) APIClient.reportError(API_BASE_URL, { type: 'STATE_OOB', current: state.current, total: state.questions.length });
        UIManager.showModal("ERROR", SYSTEM_MESSAGES.STATE_OOB_ERROR, "red");
        endGame(); 
        return;
    }
    const q = state.questions[state.current];
    UIManager.updateElement('question-text', q.text[state.lang]);
    const container = document.getElementById('options-container');
    container.innerHTML = '';
    q.options[state.lang].forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerText = opt;
        btn.onclick = () => checkAnswer(i === q.correct);
        container.appendChild(btn);
    });
}

function startTimer() {
    if (state.mode === GAME_MODES.BLITZ) {
        state.timer = 5;
    } else if (state.mode === GAME_MODES.ENDLESS) {
        const reduction = Math.floor(state.questionCount / 5);
        state.timer = Math.max(3, 15 - reduction);
    } else {
        state.timer = 15;
    }
    
    clearInterval(state.timerInterval);
    state.timerInterval = setInterval(() => {
        state.timer -= 0.1;
        const timerDisplay = document.getElementById('timeline-bar');
        if (timerDisplay) {
            const max = state.mode === GAME_MODES.BLITZ ? 5 : (state.mode === GAME_MODES.ENDLESS ? Math.max(3, 15 - Math.floor(state.questionCount / 5)) : 15);
            timerDisplay.style.width = `${(state.timer / max) * 100}%`;
        }
        if (state.timer <= 0) checkAnswer(null);
    }, 100);
}

function checkAnswer(correct) {
    clearInterval(state.timerInterval);
    state.questionCount++;
    if (correct) {
        state.streak++; state.correctAnswers++;
        state.score += GameLogic.calculateScore(state.timer, state.streak);
        if ('vibrate' in navigator) navigator.vibrate(50);
    } else {
        state.lives--; state.streak = 0;
        if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
    }
    
    UIManager.updateElement('hud-score', `${state.score}_PTS`);
    UIManager.updateElement('lives-display', state.lives);
    
    if (state.lives <= 0) endGame();
    else {
        state.current++;
        setTimeout(renderQuestion, 1000);
    }
}

async function endGame() {
    UIManager.showModal(state.score > state.best ? "NEW_BEST" : "GAME_OVER", `SCORE: ${state.score}`);
    if (state.score > state.best) {
        state.best = state.score;
        await StorageManager.saveSecure(STORAGE_KEYS.HIGH_SCORE, state.best, state.systemSecret);
    }
    await APIClient.updateLeaderboard(API_BASE_URL, {
        playerId: state.playerId, playerName: state.playerName, score: state.score, auth: state.systemSecret
    });
}

function pauseProtocol() {
    state.isPaused = true;
    clearInterval(state.timerInterval);
    UIManager.toggleClass('game-screen', 'active', false);
    UIManager.toggleClass('start-screen', 'active', true);
}

function resumeProtocol() {
    state.isPaused = false;
    UIManager.toggleClass('start-screen', 'active', false);
    UIManager.toggleClass('game-screen', 'active', true);
    startTimer();
}

function closeSystem() {
    UIManager.toggleClass('modal-overlay', 'active', false);
    document.getElementById('modal-overlay').style.display = 'none';
    UIManager.toggleClass('game-screen', 'active', false);
    UIManager.toggleClass('start-screen', 'active', true);
}

async function showLeaderboard() {
    UIManager.toggleClass('battle-lobby', 'active', false);
    UIManager.toggleClass('leaderboard-screen', 'active', true);
    const data = await APIClient.fetchLeaderboard(API_BASE_URL);
    UIManager.renderLeaderboard(document.getElementById('leaderboard-entries'), data);
}

function hideLeaderboard() {
    UIManager.toggleClass('leaderboard-screen', 'active', false);
    UIManager.toggleClass('battle-lobby', 'active', true);
}

// Korrigierte Initialisierung: Event-Listener werden nun garantiert registriert[span_1](start_span)[span_1](end_span)
initApp().catch(err => {
    console.error("Initialisierung teilweise fehlgeschlagen:", err);
}).finally(() => {
    setupEventListeners();
});
