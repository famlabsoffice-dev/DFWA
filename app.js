import { StorageManager } from './scripts/storage.js';
import { GameLogic } from './scripts/game-logic.js';
import { UIManager } from './scripts/ui-manager.js';
import { APIClient } from './scripts/api-client.js';

const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : window.location.origin;

let state = { 
    lang: 'de', questions: [], allQuestions: [], current: 0, score: 0, lives: 3,
    streak: 0, streakMax: 0, correctAnswers: 0,
    playerName: localStorage.getItem('dfwa_name') || 'GUEST',
    playerId: localStorage.getItem('dfwa_id') || Math.floor(1000 + Math.random() * 9000).toString(),
    best: parseInt(localStorage.getItem('dfwa_best') || 0),
    wins: parseInt(localStorage.getItem('dfwa_wins') || 0),
    losses: parseInt(localStorage.getItem('dfwa_losses') || 0),
    comments: {}, usedComments: { correct: [], incorrect: [] },
    isPaused: false, isProcessing: false, timer: 15, timerInterval: null, questionCount: 0,
    isChallenge: false, isCreatingChallenge: false, challengeSeed: null, opponentScore: 0,
    systemSecret: null, sessionActive: false, mode: 'classic',
    variant: localStorage.getItem('dfwa_variant') || (Math.random() < 0.5 ? 'A' : 'B')
};

// Globaler Zugriff für Legacy-Event-Handler im HTML (optional, besser EventListener nutzen)
window.state = state;
window.setLanguage = (lang) => {
    state.lang = lang;
    localStorage.setItem('dfwa_lang', lang);
    updateUIForLanguage();
};
window.showLobby = () => {
    state.playerName = document.getElementById('player-name').value.trim() || 'GUEST';
    StorageManager.saveSecure('dfwa_name', state.playerName, state.systemSecret);
    UIManager.toggleClass('start-screen', 'active', false);
    UIManager.toggleClass('battle-lobby', 'active', true);
};
window.startChallenge = startChallenge;
window.initGame = initGame;
window.resumeProtocol = resumeProtocol;
window.pauseProtocol = pauseProtocol;
window.closeSystem = closeSystem;
window.showLeaderboard = showLeaderboard;
window.hideLeaderboard = hideLeaderboard;
window.hideLobby = () => {
    UIManager.toggleClass('battle-lobby', 'active', false);
    UIManager.toggleClass('start-screen', 'active', true);
};

async function initApp() {
    state.systemSecret = await APIClient.fetchSecret(API_BASE_URL);
    await StorageManager.validateIntegrity(['dfwa_best', 'dfwa_wins', 'dfwa_losses'], state.systemSecret, (key) => {
        if (key === 'dfwa_best') state.best = 0;
        if (key === 'dfwa_wins') state.wins = 0;
        if (key === 'dfwa_losses') state.losses = 0;
    });
    detectLanguage();
}

function detectLanguage() {
    state.lang = localStorage.getItem('dfwa_lang') || (navigator.language.startsWith('de') ? 'de' : 'en');
    if (!localStorage.getItem('dfwa_id')) StorageManager.saveSecure('dfwa_id', state.playerId, state.systemSecret);
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
    state.mode = document.getElementById("mode-selector").value;
    
    UIManager.updateElement('lives-display', state.lives);
    UIManager.toggleClass('start-screen', 'active', false);
    UIManager.toggleClass('battle-lobby', 'active', false);
    UIManager.toggleClass('game-screen', 'active', true);
    
    const qRes = await fetch("questions_i18n.json");
    state.allQuestions = await qRes.json();
    const cRes = await fetch("ack_comments.json");
    state.comments = await cRes.json();
    
    state.questions = GameLogic.shuffle([...state.allQuestions], state.isChallenge ? state.challengeSeed : null);
    renderQuestion();
    startTimer();
}

function renderQuestion() {
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
    state.timer = 15;
    clearInterval(state.timerInterval);
    state.timerInterval = setInterval(() => {
        state.timer -= 0.1;
        UIManager.updateElement('timer-display', Math.ceil(state.timer));
        if (state.timer <= 0) checkAnswer(null);
    }, 100);
}

function checkAnswer(correct) {
    clearInterval(state.timerInterval);
    if (correct) {
        state.streak++; state.correctAnswers++;
        state.score += GameLogic.calculateScore(state.timer, state.streak);
    } else {
        state.lives--; state.streak = 0;
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
        await StorageManager.saveSecure('dfwa_best', state.best, state.systemSecret);
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

initApp();
