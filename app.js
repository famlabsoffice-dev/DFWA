/**
 * DFWA - Core Application Logic (RADICAL REWRITE)
 * Focus: PWA Integrity, Cache-Busting, Button Reliability
 */

import { GameLogic } from './scripts/game-logic.js';
import { GameModes, ModeConfig } from './scripts/game-modes.js';
import { UIManager } from './scripts/ui-manager.js';
import { StorageManager } from './scripts/storage.js';
import { BattleManager } from './scripts/battle-manager.js';
import { APIClient } from './scripts/api-client.js';
import { AchievementManager } from './scripts/achievement-manager.js';
import { AudioManager } from './scripts/audio-manager.js';

// PWA Update Logic - Force update on new version
async function initPWAUpdate() {
    if ('serviceWorker' in navigator) {
        try {
            const { registerSW } = await import('virtual:pwa-register');
            registerSW({
                onNeedRefresh() {
                    if (confirm('NEUE SYSTEM-VERSION VERFÜGBAR. JETZT AKTUALISIEREN?')) {
                        location.reload(true);
                    }
                },
                onOfflineReady() {
                    console.log('SYSTEM_OFFLINE_READY');
                },
            });
        } catch (e) {
            console.warn('PWA_REGISTRATION_FAILED', e);
        }
    }
}

const state = {
    playerName: localStorage.getItem('dfwa_player_name') || 'GUEST',
    selectedCategory: 'Gegenteil',
    selectedMode: GameModes.CLASSIC,
    questions: [],
    currentQuestionIndex: 0,
    score: 0,
    lives: 3,
    streak: 0,
    timer: 15,
    timerInterval: null,
    availableCategories: [],
    seed: Math.floor(Math.random() * 1000000),
    secret: 'DFWA_SYSTEM_SECURE_2026'
};

async function loadQuestions() {
    try {
        const response = await fetch(`./questions_i18n.json?cb=${Date.now()}`);
        const data = await response.json();
        state.availableCategories = [...new Set(data.map(q => q.cat))];
        return data;
    } catch (error) {
        console.error("Failed to load questions:", error);
        return [];
    }
}

function updateNameDisplay() {
    const displays = ['player-display', 'stat-player'];
    displays.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (id === 'stat-player') {
                const nameSpan = el.querySelector('#player-display') || el;
                nameSpan.textContent = state.playerName;
            } else {
                el.textContent = state.playerName;
            }
        }
    });
}

function handleAddPlayer() {
    const input = document.getElementById('player-name');
    if (input) {
        const name = input.value.trim().toUpperCase();
        if (name) {
            state.playerName = name;
            localStorage.setItem('dfwa_player_name', state.playerName);
            updateNameDisplay();
            input.value = '';
            input.placeholder = "USER_REGISTERED";
            setTimeout(() => { input.placeholder = "ENTER_CODENAME"; }, 1500);
            AudioManager.play('click');
        } else {
            input.classList.add('error-shake');
            setTimeout(() => input.classList.remove('error-shake'), 500);
        }
    }
}

function initStartScreen() {
    console.log("Initializing Start Screen (Hardened)...");
    
    // 1. PWA & Audio Init
    initPWAUpdate();
    AudioManager.init();
    updateNameDisplay();

    // 2. Button Binding - Direct & Delegated for 100% Reliability
    const bind = (id, fn) => {
        const el = document.getElementById(id);
        if (el) {
            el.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                AudioManager.play('click');
                fn(e);
            };
            // Support touch devices specifically
            el.ontouchend = (e) => {
                e.preventDefault();
                e.stopPropagation();
                AudioManager.play('click');
                fn(e);
            };
        }
    };

    bind('add-player-btn', handleAddPlayer);
    bind('start-btn', () => startGame(state.selectedCategory));
    bind('category-modal-btn', openCategoryModal);
    bind('close-system-btn', () => { document.getElementById('modal-overlay').style.display = 'none'; });
    bind('modal-close-btn', () => { document.getElementById('modal-overlay').style.display = 'none'; });
    
    // Lobby Navigation
    bind('show-lobby-btn', () => {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('battle-lobby').classList.add('active');
    });
    bind('hide-lobby-btn', () => {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('start-screen').classList.add('active');
    });

    // Leaderboard Navigation
    bind('show-leaderboard-btn', () => {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('leaderboard-screen').classList.add('active');
        // Initial load for classic mode
        const list = document.getElementById('leaderboard-entries');
        if (list) {
            APIClient.fetchLeaderboard(window.location.origin, 'classic').then(data => {
                UIManager.renderLeaderboard(list, data);
            });
        }
    });
    bind('hide-leaderboard-btn', () => {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('battle-lobby').classList.add('active');
    });

    // Lobby Functions
    bind('start-challenge-btn', async () => {
        const input = document.getElementById('challenge-code-input');
        const code = input ? input.value.trim() : '';
        if (code) {
            BattleManager.joinBattle(code);
            startGame(state.selectedCategory);
        } else {
            const newCode = await BattleManager.createChallenge();
            if (input) input.value = newCode;
            UIManager.showToast(`CHALLENGE_CREATED: ${newCode}`, 'success');
        }
    });

    bind('live-battle-btn', () => {
        BattleManager.joinBattle('LIVE_POOL');
        startGame(state.selectedCategory);
    });

    // Mode Buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
        const handleMode = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const mode = btn.dataset.mode;
            if (mode) {
                document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.selectedMode = mode;
                AudioManager.play('click');
            }
        };
        btn.onclick = handleMode;
        btn.ontouchend = handleMode;
    });

    // Profile Trigger
    bind('stat-id', async () => {
        const playerId = localStorage.getItem('dfwa_player_id');
        const profile = await APIClient.fetchProfile(window.location.origin, playerId);
        UIManager.showProfile(profile || {
            playerName: state.playerName,
            score: localStorage.getItem('dfwa_high_score') || 0,
            wins: 0,
            losses: 0,
            league: 'BRONZE',
            elo: 1000
        });
    });

    // 3. Question Preloading
    loadQuestions().then(allQuestions => {
        window.allQuestions = allQuestions;
    });

    // 4. BattleManager Init
    const playerId = localStorage.getItem('dfwa_player_id') || `ID_${Math.random().toString(36).slice(2, 9).toUpperCase()}`;
    localStorage.setItem('dfwa_player_id', playerId);
    BattleManager.init(window.location.origin, playerId, state.playerName);

    // 5. Initial Sync
    if (navigator.onLine) {
        APIClient.syncProfile(window.location.origin, {
            playerId,
            playerName: state.playerName,
            score: localStorage.getItem('dfwa_high_score') || 0,
            wins: 0,
            losses: 0,
            league: 'BRONZE',
            elo: 1000,
            achievements: []
        }, state.secret);
    }
}

function openCategoryModal() {
    const overlay = document.getElementById('modal-overlay');
    const list = document.getElementById('category-modal-list');
    if (overlay && list) {
        UIManager.showModal("SELECT_OPERATIONAL_REALM", "");
        list.style.display = 'grid';
        list.innerHTML = '';
        state.availableCategories.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.textContent = cat.toUpperCase();
            btn.onclick = (e) => {
                e.preventDefault();
                startGame(cat);
            };
            list.appendChild(btn);
        });
        overlay.style.display = 'flex';
    }
}

async function startGame(category) {
    state.selectedCategory = category;
    if (!window.allQuestions) window.allQuestions = await loadQuestions();
    
    state.questions = GameLogic.shuffle(
        window.allQuestions.filter(q => q.cat === category),
        state.seed
    );

    const config = ModeConfig[state.selectedMode] || ModeConfig.classic;
    state.lives = config.initialLives;
    state.timer = config.initialTimer;
    state.score = 0;
    state.streak = 0;
    state.currentQuestionIndex = 0;

    document.getElementById('modal-overlay').style.display = 'none';
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('game-screen').classList.add('active');
    
    updateHUD();
    BattleManager.syncState({ score: state.score, streak: state.streak });
    AudioManager.startMusic();
    showNextQuestion();
}

function updateHUD() {
    UIManager.setText('hud-score', `${state.score}_PTS`);
    UIManager.setText('lives-display', state.lives);
}

function showNextQuestion() {
    if (state.lives <= 0 || state.currentQuestionIndex >= state.questions.length) {
        endGame();
        return;
    }

    const q = state.questions[state.currentQuestionIndex];
    UIManager.setText('cat-display', `SECTOR: ${state.selectedCategory.toUpperCase()}`);
    UIManager.setText('question-text', q.text.de || q.text);
    
    const container = document.getElementById('options-container');
    if (container) {
        container.innerHTML = '';
        const options = q.options.de || q.options;
        options.forEach((opt, index) => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.textContent = opt;
            const submit = (e) => {
                e.preventDefault();
                handleAnswer(index === q.correct);
            };
            btn.onclick = submit;
            btn.ontouchend = submit;
            container.appendChild(btn);
        });
    }
    startTimer();
}

function startTimer() {
    clearInterval(state.timerInterval);
    const config = ModeConfig[state.selectedMode] || ModeConfig.classic;
    state.timer = config.initialTimer;
    updateTimerUI();
    state.timerInterval = setInterval(() => {
        state.timer -= 0.1;
        if (state.timer <= 0) {
            clearInterval(state.timerInterval);
            handleAnswer(false);
        }
        updateTimerUI();
    }, 100);
}

function updateTimerUI() {
    const config = ModeConfig[state.selectedMode] || ModeConfig.classic;
    const bar = document.getElementById('timer-bar');
    const text = document.getElementById('timer-text');
    if (bar) bar.style.width = `${(state.timer / config.initialTimer) * 100}%`;
    if (text) text.textContent = `${Math.ceil(state.timer)}S`;
    AudioManager.updateMusicSpeed(state.timer, config.initialTimer);
}

function handleAnswer(isCorrect) {
    clearInterval(state.timerInterval);
    const config = ModeConfig[state.selectedMode] || ModeConfig.classic;

    if (isCorrect) {
        if ('vibrate' in navigator) navigator.vibrate(50);
        state.score += Math.round(GameLogic.calculateScore(state.timer, state.streak + 1) * config.scoreMultiplier);
        state.streak++;
        showFeedback(true);
        BattleManager.sendAction({ type: 'correct', score: state.score });
        if (state.streak >= 5) {
            BattleManager.sendAction({ type: 'sabotage', sabotageType: 'timer_drain', duration: 5 });
            UIManager.showToast("SABOTAGE_DEPLOYED!", "warning");
        }
    } else {
        if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
        state.lives--;
        state.streak = 0;
        showFeedback(false);
        BattleManager.sendAction({ type: 'error', score: state.score });
    }
    
    updateHUD();
    setTimeout(() => {
        state.currentQuestionIndex++;
        showNextQuestion();
    }, 1000);
}

function showFeedback(isCorrect) {
    const eye = document.getElementById('cyber-eye');
    const overlay = document.getElementById('sabotage-overlay');
    if (eye) {
        eye.src = isCorrect ? './assets/images/ack_cyber_eye_green.webp' : './assets/images/ack_cyber_eye_red.webp';
        eye.classList.add('feedback-pulse');
        setTimeout(() => eye.classList.remove('feedback-pulse'), 800);
    }
    if (!isCorrect && overlay) {
        overlay.classList.add('sabotage-active');
        setTimeout(() => overlay.classList.remove('sabotage-active'), 500);
    }
}

async function endGame() {
    clearInterval(state.timerInterval);
    AudioManager.stopMusic();
    
    const high_score = parseInt(localStorage.getItem('dfwa_high_score') || '0');
    const isNewHighscore = state.score > high_score;
    if (isNewHighscore) {
        localStorage.setItem('dfwa_high_score', state.score);
        UIManager.launchConfetti();
    }

    const payload = await GameLogic.generateAuthPayload(
        localStorage.getItem('dfwa_player_id'),
        state.score,
        0, 0, // Wins/Losses placeholder
        state.selectedMode,
        state.secret
    );
    
    APIClient.submitScore(window.location.origin, payload);
    UIManager.showModal(
        isNewHighscore ? "NEW_RECORD_ESTABLISHED" : "SESSION_TERMINATED",
        `FINAL_SCORE: ${state.score}_PTS`,
        isNewHighscore ? "var(--neon)" : "var(--error)"
    );

    setTimeout(() => {
        document.getElementById('modal-overlay').style.display = 'none';
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('start-screen').classList.add('active');
    }, 3000);
}

// Global Initialization
document.addEventListener('DOMContentLoaded', initStartScreen);
window.addEventListener('load', () => {
    // Force immediate PWA registration check
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
});
