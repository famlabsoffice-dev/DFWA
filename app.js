/**
 * DFWA - Core Application Logic
 * Integrates high-quality question catalogs and active module system.
 */

import { GameLogic } from './scripts/game-logic.js';
import { GameModes, ModeConfig } from './scripts/game-modes.js';
import { UIManager } from './scripts/ui-manager.js';
import { StorageManager } from './scripts/storage.js';
import { BattleManager } from './scripts/battle-manager.js';
import { APIClient } from './scripts/api-client.js';
import { AchievementManager } from './scripts/achievement-manager.js';
import { AudioManager } from './scripts/audio-manager.js';

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
    secret: 'DFWA_SYSTEM_SECURE_2026' // Placeholder for HMAC
};

async function loadQuestions() {
    try {
        const response = await fetch('./questions_i18n.json');
        const data = await response.json();
        state.availableCategories = [...new Set(data.map(q => q.cat))];
        console.log("Loaded categories:", state.availableCategories);
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
                const nameSpan = el.querySelector('#player-display');
                if (nameSpan) {
                    if (nameSpan.textContent !== state.playerName) {
                        nameSpan.textContent = state.playerName;
                    }
                } else {
                    el.innerHTML = `USER_IDENT//<br /><span id="player-display">${state.playerName}</span>`;
                }
            } else {
                if (el.textContent !== state.playerName) {
                    el.textContent = state.playerName;
                }
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
        } else {
            input.classList.add('error-shake');
            setTimeout(() => input.classList.remove('error-shake'), 500);
        }
    }
}

function initStartScreen() {
    console.log("Initializing DFWA Core...");
    initPWAUpdate();
    AudioManager.init();
    
    const eyeContainer = document.getElementById('eye-bg-container');
    if (eyeContainer) {
        eyeContainer.style.animation = 'none';
        eyeContainer.style.filter = 'none';
    }

    updateNameDisplay();

    // Global Interaction Handler
    const handleGlobalClick = (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        if ('vibrate' in navigator) navigator.vibrate(10);
        AudioManager.play('click');

        if (target.id === 'start-btn') {
            startGame(state.selectedCategory);
        } else if (target.id === 'category-modal-btn') {
            openCategoryModal();
        } else if (target.id === 'add-player-btn') {
            handleAddPlayer();
        } else if (target.id === 'close-system-btn' || target.id === 'modal-close-btn') {
            document.getElementById('modal-overlay').style.display = 'none';
        } else if (target.classList.contains('mode-btn') && target.dataset.mode) {
            const container = target.closest('.mode-selector-container');
            if (container) {
                container.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
                target.classList.add('active');
            }
            
            const modeValue = target.dataset.mode;
            if (Object.values(GameModes).includes(modeValue)) {
                state.selectedMode = modeValue;
                console.log("Mode selected:", state.selectedMode);
            }
        }
    };

    document.body.removeEventListener('click', handleGlobalClick);
    document.body.addEventListener('click', handleGlobalClick, { passive: false });
    // pointerup removed to prevent double triggers on mobile devices

    loadQuestions().then(allQuestions => {
        window.allQuestions = allQuestions;
    });

    setInterval(updateNameDisplay, 500);

    // Initialize BattleManager
    const playerId = localStorage.getItem('dfwa_player_id') || `ID_${Math.random().toString(36).slice(2, 9).toUpperCase()}`;
    localStorage.setItem('dfwa_player_id', playerId);
    BattleManager.init(window.location.origin, playerId, state.playerName);

    // Profile Interaction
    const profileTrigger = document.getElementById('stat-id');
    if (profileTrigger) {
        profileTrigger.onclick = async () => {
            const baseUrl = window.location.origin;
            const profile = await APIClient.fetchProfile(baseUrl, playerId);
            if (profile) {
                UIManager.showProfile(profile);
            } else {
                // Fallback to local data if sync failed
                UIManager.showProfile({
                    playerName: state.playerName,
                    score: localStorage.getItem('dfwa_high_score') || 0,
                    wins: 0,
                    losses: 0,
                    league: 'BRONZE',
                    elo: 1000
                });
            }
        };
    }

    // Initial Profile Sync
    const high_score = localStorage.getItem('dfwa_high_score') || 0;
    const achievements = JSON.parse(localStorage.getItem('dfwa_achievements') || '[]');
    
    const syncProfile = () => {
        APIClient.syncProfile(window.location.origin, {
            playerId,
            playerName: state.playerName,
            score: high_score,
            wins: 0,
            losses: 0,
            league: 'BRONZE',
            elo: 1000,
            achievements: AchievementManager.getAchievementNames(achievements)
        }, state.secret);
    };

    if (navigator.onLine) {
        syncProfile();
    }
    window.addEventListener('online', syncProfile);

    // Social System Integration
    const friendsListContainer = document.getElementById('friends-list');
    const friendIdInput = document.getElementById('friend-id-input');
    const sendFriendBtn = document.getElementById('send-friend-request-btn');

    const updateFriends = async () => {
        const friends = await APIClient.fetchFriends(window.location.origin, playerId);
        UIManager.renderFriendsList(friendsListContainer, friends, async (friendId) => {
            const challengeCode = await BattleManager.createChallenge();
            UIManager.showToast(`INVITE_SENT_TO: ${friendId}`, "info");
            // In a real scenario, we would send a socket message or notification here
            // For now, we just populate the challenge code
            if (friendIdInput) friendIdInput.value = challengeCode;
        });
    };

    if (sendFriendBtn && friendIdInput) {
        sendFriendBtn.onclick = async () => {
            const receiverId = friendIdInput.value.trim();
            if (receiverId) {
                const result = await APIClient.sendFriendRequest(window.location.origin, playerId, receiverId, state.secret);
                if (result.success) {
                    UIManager.showToast("LINK_REQUEST_SENT", "success");
                    friendIdInput.value = '';
                } else {
                    UIManager.showToast(`ERROR: ${result.error || 'LINK_FAILED'}`, "error");
                }
            }
        };
    }

    // Battle Lobby UI Handlers
    const showLobbyBtn = document.getElementById('show-lobby-btn');
    if (showLobbyBtn) {
        showLobbyBtn.onclick = () => {
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            document.getElementById('battle-lobby').classList.add('active');
            updateFriends();
        };
    }

    const hideLobbyBtn = document.getElementById('hide-lobby-btn');
    if (hideLobbyBtn) {
        hideLobbyBtn.onclick = () => {
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            document.getElementById('start-screen').classList.add('active');
        };
    }

    const liveBattleBtn = document.getElementById('live-battle-btn');
    if (liveBattleBtn) {
        liveBattleBtn.onclick = () => {
            BattleManager.joinBattle('GLOBAL_ARENA');
        };
    }

    const startChallengeBtn = document.getElementById('start-challenge-btn');
    const challengeInput = document.getElementById('challenge-code-input');
    if (startChallengeBtn && challengeInput) {
        startChallengeBtn.onclick = async () => {
            const code = challengeInput.value.trim().toUpperCase();
            if (code) {
                BattleManager.joinBattle(code);
            } else {
                const newCode = await BattleManager.createChallenge();
                challengeInput.value = newCode;
                UIManager.showToast(`CHALLENGE_CREATED: ${newCode}`, "warning");
            }
        };
    }

    const refreshLobbyBtn = document.getElementById('refresh-lobby-btn');
    if (refreshLobbyBtn) {
        refreshLobbyBtn.onclick = () => {
            if (BattleManager.socket) {
                BattleManager.socket.disconnect().connect();
                UIManager.showToast("RE-ESTABLISHING_LINK...", "info");
            }
        };
    }

    const showLeaderboardBtn = document.getElementById('show-leaderboard-btn');
    if (showLeaderboardBtn) {
        showLeaderboardBtn.onclick = async () => {
            const entriesDiv = document.getElementById('leaderboard-entries');
            const data = await APIClient.fetchLeaderboard(window.location.origin, 20, 'classic');
            if (data && data.entries) {
                UIManager.renderLeaderboard(entriesDiv, data.entries);
                
                const seasonDash = document.getElementById('season-dashboard');
                if (data.season && seasonDash) {
                    seasonDash.style.display = 'block';
                    document.getElementById('season-number').textContent = data.season.season_number;
                }
            }
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            document.getElementById('leaderboard-screen').classList.add('active');
        };
    }

    const hideLeaderboardBtn = document.getElementById('hide-leaderboard-btn');
    if (hideLeaderboardBtn) {
        hideLeaderboardBtn.onclick = () => {
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            document.getElementById('battle-lobby').classList.add('active');
        };
    }

    const leaderboardFilters = document.querySelectorAll('#leaderboard-filters .mode-btn');
    leaderboardFilters.forEach(btn => {
        btn.addEventListener('click', async () => {
            leaderboardFilters.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const mode = btn.dataset.mode;
            const entriesDiv = document.getElementById('leaderboard-entries');
            const data = await APIClient.fetchLeaderboard(window.location.origin, 20, mode);
            if (data && data.entries) {
                UIManager.renderLeaderboard(entriesDiv, data.entries);
            }
        });
    });

    // Sabotage Event Listener
    window.addEventListener('sabotage_timer', (e) => {
        const duration = e.detail.duration || 5;
        state.timer = Math.max(0, state.timer - duration);
        updateTimerUI();
    });
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
                e.stopPropagation();
                startGame(cat);
            };
            list.appendChild(btn);
        });
        overlay.style.display = 'flex';
    }
}

async function startGame(category) {
    state.selectedCategory = category;
    if (!window.allQuestions) {
        window.allQuestions = await loadQuestions();
    }
    
    state.questions = GameLogic.shuffle(
        window.allQuestions.filter(q => q.cat === category),
        state.seed
    );

    const config = ModeConfig[state.selectedMode];
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
    const catDisplay = document.getElementById('cat-display');
    const questionText = document.getElementById('question-text');
    const optionsContainer = document.getElementById('options-container');

    if (catDisplay) catDisplay.textContent = `SECTOR: ${state.selectedCategory.toUpperCase()}`;
    if (questionText) questionText.textContent = q.text.de || q.text;
    
    if (optionsContainer) {
        optionsContainer.innerHTML = '';
        const options = q.options.de || q.options;
        options.forEach((opt, index) => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.textContent = opt;
            const submitAnswer = (e) => {
                e.preventDefault();
                handleAnswer(index === q.correct);
            };
            btn.addEventListener('pointerup', submitAnswer);
            btn.addEventListener('click', submitAnswer);
            optionsContainer.appendChild(btn);
        });
    }
    startTimer();
}

function startTimer() {
    clearInterval(state.timerInterval);
    const config = ModeConfig[state.selectedMode];
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
    const config = ModeConfig[state.selectedMode];
    const bar = document.getElementById('timer-bar');
    const text = document.getElementById('timer-text');
    if (bar) bar.style.width = `${(state.timer / config.initialTimer) * 100}%`;
    if (text) text.textContent = `${Math.ceil(state.timer)}S`;
    AudioManager.updateMusicSpeed(state.timer, config.initialTimer);
}

function handleAnswer(isCorrect) {
    clearInterval(state.timerInterval);
    const config = ModeConfig[state.selectedMode];

    if (isCorrect) {
        if ('vibrate' in navigator) navigator.vibrate(20);
        const points = GameLogic.calculateScore(state.timer, state.streak + 1);
        state.score += Math.round(points * config.scoreMultiplier);
        state.streak++;
        if ('vibrate' in navigator) navigator.vibrate(50);
        showFeedback(true);
        
        // Sync Battle State
        BattleManager.sendAction({ type: 'correct', score: state.score });
        
        // Sabotage Opponent on high streak
        if (state.streak >= 5) {
            BattleManager.sendAction({ 
                type: 'sabotage', 
                sabotageType: 'timer_drain', 
                duration: 5 
            });
            UIManager.showToast("SABOTAGE_DEPLOYED!", "warning");
        }
    } else {
        state.lives--;
        state.streak = 0;
        if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
        showFeedback(false);
        
        // Sync Battle State
        BattleManager.sendAction({ type: 'error', score: state.score });
    }
    
    BattleManager.syncState({ score: state.score, streak: state.streak });

    updateHUD();
    state.currentQuestionIndex++;
    
    const isGameOver = state.lives <= 0 || 
                       (config.maxQuestions && state.currentQuestionIndex >= config.maxQuestions) ||
                       state.currentQuestionIndex >= state.questions.length;

    if (isGameOver) {
        setTimeout(endGame, 1000);
    } else {
        setTimeout(showNextQuestion, 1000);
    }
}

function showFeedback(isCorrect) {
    const screen = document.getElementById('feedback-screen');
    const msg = document.getElementById('feedback-msg');
    const eyeBase = document.getElementById('feedback-eye-base');
    if (screen && msg && eyeBase) {
        const correctImages = [
            './assets/images/ack_victory.webp',
            './assets/images/ack_eye_wink.webp',
            './assets/images/ack_hypnotic_opening.webp'
        ];
        const wrongImages = [
            './assets/images/ack_defeat.webp',
            './assets/images/ack_eye_skeptical.webp',
            './assets/images/ack_interference_glitch.webp',
            './assets/images/ack_panic_hamster.webp'
        ];
        const selectedImage = isCorrect 
            ? correctImages[Math.floor(Math.random() * correctImages.length)]
            : wrongImages[Math.floor(Math.random() * wrongImages.length)];
        
        eyeBase.src = selectedImage;
        msg.textContent = isCorrect ? "ACCESS_GRANTED" : "CONNECTION_LOST";
        msg.style.color = isCorrect ? "var(--neon)" : "var(--error)";
        
        const sabotageLayer = document.getElementById('sabotage-overlay');
        if (!isCorrect && sabotageLayer) {
            sabotageLayer.classList.add('sabotage-active');
            setTimeout(() => sabotageLayer.classList.remove('sabotage-active'), 500);
        }

        screen.classList.add('active');
        setTimeout(() => screen.classList.remove('active'), 1200);
    }
}

// Preload feedback images for zero-latency response
function preloadFeedbackAssets() {
    const assets = [
        './assets/images/ack_victory.webp',
        './assets/images/ack_eye_wink.webp',
        './assets/images/ack_hypnotic_opening.webp',
        './assets/images/ack_defeat.webp',
        './assets/images/ack_eye_skeptical.webp',
        './assets/images/ack_interference_glitch.webp',
        './assets/images/ack_panic_hamster.webp'
    ];
    assets.forEach(url => {
        const img = new Image();
        img.src = url;
    });
}
preloadFeedbackAssets();

async function endGame() {
    clearInterval(state.timerInterval);
    AudioManager.stopMusic();
    
    // Achievement Check
    const localAchievements = JSON.parse(localStorage.getItem('dfwa_achievements') || '[]');
    const newlyUnlocked = AchievementManager.checkAchievements(state, localAchievements);
    if (newlyUnlocked.length > 0) {
        const updatedAchievements = [...localAchievements, ...newlyUnlocked];
        localStorage.setItem('dfwa_achievements', JSON.stringify(updatedAchievements));
        AudioManager.play('achievement');
        newlyUnlocked.forEach(id => {
            const ach = AchievementManager.ACHIEVEMENTS.find(a => a.id === id);
            UIManager.showToast(`UNLOCKED: ${ach.name}`, "neon");
        });
    }

    // HMAC & Secure Storage Integration
    try {
        const playerId = localStorage.getItem('dfwa_player_id') || `ID_${Math.random().toString(36).slice(2, 9).toUpperCase()}`;
        localStorage.setItem('dfwa_player_id', playerId);

        const payload = await GameLogic.generateAuthPayload(
            playerId,
            state.score,
            0, // wins (placeholder)
            0, // losses (placeholder)
            state.selectedMode,
            state.secret
        );
        
        console.log("SECURE_AUTH_PAYLOAD_GENERATED", payload);
        
        // Save score securely
        const oldHighScore = localStorage.getItem('dfwa_high_score') || 0;
        if (state.score > oldHighScore) {
            UIManager.launchConfetti();
            if ('vibrate' in navigator) navigator.vibrate([50, 50, 50, 50, 100]);
        }
        await StorageManager.saveSecure('dfwa_last_score', state.score, state.secret);
        
        // Attempt to submit score to backend
        fetch('/api/leaderboard', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...payload,
                playerName: state.playerName
            })
        }).then(res => res.json()).then(data => {
            console.log("BACKEND_SYNC_RESULT", data);
        }).catch(err => {
            console.warn("BACKEND_SYNC_FAILED", err);
        });

        UIManager.showModal(
            "SESSION_TERMINATED", 
            `FINAL_SCORE: ${state.score}_PTS | SECTOR: ${state.selectedCategory}\nSYNC_AUTH: ${payload.auth.slice(0, 8)}...`
        );
    } catch (e) {
        console.error("SECURE_FINALIZATION_FAILED", e);
        UIManager.showModal(
            "SESSION_TERMINATED", 
            `FINAL_SCORE: ${state.score}_PTS | SECTOR: ${state.selectedCategory}`
        );
    }

    const list = document.getElementById('category-modal-list');
    if (list) list.style.display = "none";
}

function initPWAUpdate() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            const banner = document.createElement('div');
            banner.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; 
                background: var(--neon); color: #000; 
                padding: 10px; text-align: center; font-weight: bold; z-index: 9999;
            `;
            banner.textContent = "UPDATING_CORE_SYSTEM...";
            document.body.appendChild(banner);
            setTimeout(() => window.location.reload(), 1500);
        });
    }
}

document.addEventListener('DOMContentLoaded', initStartScreen);
