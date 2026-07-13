/**
 * DFWA - Core Application Logic
 * Integrates high-quality question catalogs and fixes UI interactions.
 */

const state = {
    playerName: localStorage.getItem('dfwa_player_name') || 'GUEST',
    selectedCategory: 'Gegenteil', // Default category from JSON
    questions: [],
    currentQuestionIndex: 0,
    score: 0,
    lives: 3,
    streak: 0,
    timer: 15,
    timerInterval: null,
    availableCategories: []
};

async function loadQuestions() {
    try {
        const response = await fetch('./questions_i18n.json');
        const data = await response.json();
        
        // Extract unique categories
        state.availableCategories = [...new Set(data.map(q => q.cat))];
        console.log("Loaded categories:", state.availableCategories);
        
        return data;
    } catch (error) {
        console.error("Failed to load questions:", error);
        return [];
    }
}

function initStartScreen() {
    console.log("Initializing DFWA Core...");
    initPWAUpdate();
    
    // Re-enable and optimize core animations for 1A quality
    const eyeContainer = document.getElementById('eye-bg-container');
    if (eyeContainer) {
        eyeContainer.style.animation = 'irisPulse 8s ease-in-out infinite, irisFloat 12s ease-in-out infinite';
    }
    
    const coreEye = document.getElementById('core-eye');
    if (coreEye) {
        coreEye.style.animation = 'irisScan 15s linear infinite';
    }

    updateNameDisplay();

    // Härtung der Event-Listener für Mobile/Touch
    let lastInteractionTime = 0;
    const handleInteraction = (e) => {
        // Verhindere Ghost-Clicks und Double-Taps (300ms Threshold)
        const now = Date.now();
        if (now - lastInteractionTime < 300) return;
        lastInteractionTime = now;

        const target = e.target.closest('button');
        if (!target) return;

        // Verhindere Standard-Event-Propagation
        if (e.cancelable) e.preventDefault();

        console.log(`Interaction detected on: ${target.id || 'anonymous button'}`);
        
        if ('vibrate' in navigator) navigator.vibrate(10);

        if (target.id === 'category-modal-btn') {
            showCategoryModal();
        } else if (target.id === 'add-player-btn') {
            handleAddPlayer();
        } else if (target.id === 'start-btn') {
            startGame();
        } else if (target.id === 'live-test-btn') {
            handleLiveTest();
        } else if (target.id === 'show-lobby-btn') {
            showLobby();
        } else if (target.id === 'hide-lobby-btn') {
            hideLobby();
        } else if (target.id === 'close-system-btn') {
            const overlay = document.getElementById('modal-overlay');
            if (overlay) overlay.style.display = 'none';
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            document.getElementById('start-screen').classList.add('active');
        } else if (target.id === 'show-leaderboard-btn') {
            showLeaderboard();
        } else if (target.id === 'hide-leaderboard-btn') {
            hideLobby(); // Zurück zur Lobby
        } else if (target.id === 'send-request-btn') {
            handleSendFriendRequest();
        } else if (target.classList.contains('add-friend-btn')) {
            handleSendFriendRequest(target.dataset.id);
        } else if (target.classList.contains('accept-friend-btn')) {
            handleAcceptFriendRequest(target.dataset.requestId);
        } else if (target.classList.contains('mode-btn')) {
            // Update mode filter visually and reload
            document.querySelectorAll('#leaderboard-filters .mode-btn').forEach(b => b.classList.remove('active'));
            target.classList.add('active');
            loadLeaderboard(target.dataset.mode);
        }
    };

    const showLeaderboard = async () => {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('leaderboard-screen').classList.add('active');
        await loadLeaderboard();
        await loadSocialData();
    };

    const loadLeaderboard = async (mode = 'classic') => {
        const entriesDiv = document.getElementById('leaderboard-entries');
        try {
            const data = await APIClient.fetchLeaderboard(window.location.origin, 20, mode);
            if (data && data.entries) {
                UIManager.renderLeaderboard(entriesDiv, data.entries);
                
                const seasonDash = document.getElementById('season-dashboard');
                if (data.season && seasonDash) {
                    seasonDash.style.display = 'block';
                    document.getElementById('season-number').textContent = data.season.season_number;
                }
            }
        } catch (err) {
            console.error("LEADERBOARD_SYNC_FAILED", err);
        }
    };

    const loadSocialData = async () => {
        const friendListDiv = document.getElementById('friend-list');
        const friendCountSpan = document.getElementById('friend-count');
        const pendingContainer = document.getElementById('pending-requests-container');
        const playerId = localStorage.getItem('dfwa_player_id');
        
        try {
            // Load Friends
            const friends = await APIClient.listFriends(window.location.origin, playerId);
            UIManager.renderFriends(friendListDiv, friends);
            if (friendCountSpan) friendCountSpan.textContent = friends.length;

            // Load Pending Requests
            const pending = await APIClient.fetchPendingRequests(window.location.origin, playerId);
            UIManager.renderPendingRequests(pendingContainer, pending);
        } catch (err) {
            console.error("SOCIAL_SYNC_FAILED", err);
        }
    };

    const handleSendFriendRequest = async (explicitId = null) => {
        const input = document.getElementById('friend-id-input');
        const receiverId = explicitId || input.value.trim();
        const senderId = localStorage.getItem('dfwa_player_id');
        
        if (!receiverId) return;
        
        const success = await APIClient.sendFriendRequest(window.location.origin, senderId, receiverId, state.secret);
        if (success) {
            UIManager.showToast("REQUEST_SENT", "neon");
            if (!explicitId) input.value = '';
            // Clear search results if any
            const resultsContainer = document.getElementById('search-results-container');
            if (resultsContainer) resultsContainer.innerHTML = '';
            const searchInput = document.getElementById('friend-search-input');
            if (searchInput) searchInput.value = '';
        } else {
            UIManager.showToast("LINK_FAILED", "error");
        }
    };

    const handleAcceptFriendRequest = async (requestId) => {
        const playerId = localStorage.getItem('dfwa_player_id');
        const success = await APIClient.acceptFriendRequest(window.location.origin, requestId, playerId, state.secret);
        if (success) {
            UIManager.showToast("LINK_ESTABLISHED", "neon");
            await loadSocialData();
        } else {
            UIManager.showToast("ACCEPT_FAILED", "error");
        }
    };

    const handleFriendSearch = async (e) => {
        const query = e.target.value.trim();
        const resultsContainer = document.getElementById('search-results-container');
        const playerId = localStorage.getItem('dfwa_player_id');

        if (query.length < 2) {
            resultsContainer.innerHTML = '';
            return;
        }

        const results = await APIClient.searchPlayers(window.location.origin, query, playerId);
        UIManager.renderSearchResults(resultsContainer, results);
    };

    // Add search listener
    const searchInput = document.getElementById('friend-search-input');
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => handleFriendSearch(e), 300);
        });
    }

    // Nutze 'pointerdown' für schnellste Reaktion auf Mobile, 'click' als stabilen Fallback
    document.body.addEventListener('pointerdown', (e) => {
        // Fix: Verhindere Propagation, wenn das Modal offen ist, um sofortiges Schließen zu vermeiden
        const overlay = document.getElementById('modal-overlay');
        if (overlay && overlay.style.display === 'flex') {
            if (e.target === overlay || overlay.contains(e.target)) {
                return; 
            }
        }

        if (e.pointerType === 'touch' || e.pointerType === 'mouse') {
            handleInteraction(e);
        }
    }, { passive: false });

    // Fallback für Umgebungen ohne PointerEvents
    if (!window.PointerEvent) {
        document.body.addEventListener('touchstart', (e) => {
            const overlay = document.getElementById('modal-overlay');
            if (overlay && overlay.style.display === 'flex') return;
            handleInteraction(e);
        }, { passive: false });
        document.body.addEventListener('click', (e) => {
            const overlay = document.getElementById('modal-overlay');
            if (overlay && overlay.style.display === 'flex') return;
            handleInteraction(e);
        });
    }

    // Remove redundant Server Room button from start screen if it exists
    const startLeaderboardBtn = document.getElementById('start-show-leaderboard-btn');
    if (startLeaderboardBtn) {
        startLeaderboardBtn.remove();
    }

    // Initial load of questions to populate categories
    loadQuestions().then(allQuestions => {
        window.allQuestions = allQuestions; // Global cache
        if (state.availableCategories.length > 0 && !state.availableCategories.includes(state.selectedCategory)) {
            state.selectedCategory = state.availableCategories[0];
            const display = document.getElementById('current-category-display');
            if (display) display.textContent = state.selectedCategory.toUpperCase();
        }
    });

    // UI Heartbeat for Name Sync
    setInterval(updateNameDisplay, 500);
}

async function handleLiveTest() {
    const btn = document.getElementById('live-test-btn');
    const originalText = btn.innerText;
    btn.innerText = 'TESTING...';
    btn.disabled = true;
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch('/api/health', { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        if (data.status === 'ok') {
            btn.style.borderColor = 'var(--neon)';
            btn.style.color = 'var(--neon)';
            btn.innerText = 'CORE_ONLINE';
            const dbStatus = data.database === 'connected' ? 'DB_OK' : 'DB_WARN';
            UIManager.showToast(`SYSTEM_OPERATIONAL [${dbStatus}]`, 'neon');
        } else {
            throw new Error('Invalid response');
        }
    } catch (err) {
        btn.style.borderColor = 'var(--error)';
        btn.style.color = 'var(--error)';
        btn.innerText = 'CORE_OFFLINE';
        UIManager.showToast(`ERROR: ${err.message}`, 'error');
    } finally {
        setTimeout(() => {
            btn.innerText = originalText;
            btn.style.borderColor = 'var(--warning)';
            btn.style.color = 'var(--warning)';
            btn.disabled = false;
        }, 2000);
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
            // Visuelles Feedback
            input.placeholder = "USER_REGISTERED";
            setTimeout(() => { input.placeholder = "ENTER_CODENAME"; }, 1500);
        } else {
            // Error Feedback
            input.classList.add('error-shake');
            setTimeout(() => input.classList.remove('error-shake'), 500);
        }
    }
}

function showCategoryModal() {
    const overlay = document.getElementById('modal-overlay');
    const title = document.getElementById('modal-title');
    const list = document.getElementById('category-modal-list');
    const text = document.getElementById('modal-text');
    
    if (overlay && list) {
        title.textContent = "SELECT_OPERATIONAL_REALM";
        text.textContent = "Choose your data sector:";
        list.style.display = "grid";
        list.innerHTML = ''; 
        
        state.availableCategories.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = 'mode-btn';
            if (cat === state.selectedCategory) btn.classList.add('active');
            btn.innerHTML = `<strong>${cat.toUpperCase()}</strong><small>DATA_SECTOR_${cat.slice(0,3).toUpperCase()}</small>`;
            
            const selectCat = (e) => {
                e.preventDefault();
                e.stopPropagation();
                state.selectedCategory = cat;
                const display = document.getElementById('current-category-display');
                if (display) display.textContent = cat.toUpperCase();
                overlay.style.display = 'none';
                if ('vibrate' in navigator) navigator.vibrate(20);
            };
            
            // Verwende nur 'click' innerhalb des Modals, da der globale Listener bereits auf Body liegt
            // und wir hier eine isolierte Auswahl benötigen.
            btn.addEventListener('click', selectCat);
            list.appendChild(btn);
        });
        
        overlay.style.display = 'flex';
    }
}

function startGame() {
    console.log("Attempting to start game...");
    if (!window.allQuestions) {
        console.warn("Questions not loaded yet. Retrying...");
        loadQuestions().then(allQuestions => {
            window.allQuestions = allQuestions;
            if (window.allQuestions) startGame();
        });
        return;
    }
    
    // Normalisierung des Kategorienamens (z.B. "Literatur" vs "LITERATUR")
    const targetCat = state.selectedCategory.toLowerCase();
    state.questions = window.allQuestions.filter(q => q.cat.toLowerCase() === targetCat);
    
    if (state.questions.length === 0) {
        console.error("No questions found for category:", state.selectedCategory);
        state.questions = window.allQuestions.slice(0, 20); // Fallback
    }

    // Shuffle questions
    state.questions.sort(() => Math.random() - 0.5);
    
    state.currentQuestionIndex = 0;
    state.score = 0;
    state.lives = 3;
    state.streak = 0;
    
    // Härtung: Alle Screens explizit deaktivieren, bevor der neue aktiviert wird
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('game-screen').classList.add('active');
    
    showNextQuestion();
}

function showNextQuestion() {
    if (state.currentQuestionIndex >= state.questions.length || state.lives <= 0) {
        endGame();
        return;
    }
    
    const q = state.questions[state.currentQuestionIndex];
    // Nutze sowohl question-text als auch question-box für maximale Kompatibilität
    const questionBox = document.getElementById('question-box') || document.getElementById('question-text');
    const optionsContainer = document.getElementById('options-container');
    const catDisplay = document.getElementById('cat-display');
    
    if (catDisplay) catDisplay.textContent = `SECTOR: ${state.selectedCategory.toUpperCase()}`;
    if (questionBox) questionBox.textContent = q.text.de || q.text;
    
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
    state.timer = 15;
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
    const bar = document.getElementById('timer-bar');
    const text = document.getElementById('timer-text');
    if (bar) bar.style.width = `${(state.timer / 15) * 100}%`;
    if (text) text.textContent = `${Math.ceil(state.timer)}S`;
}

function handleAnswer(isCorrect) {
    clearInterval(state.timerInterval);
    
    if (isCorrect) {
        state.score += 100 + (state.streak * 10);
        state.streak++;
        if ('vibrate' in navigator) navigator.vibrate(50);
        showFeedback(true);
    } else {
        state.lives--;
        state.streak = 0;
        if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
        showFeedback(false);
    }
    
    document.getElementById('hud-score').textContent = `${state.score}_PTS`;
    document.getElementById('lives-display').textContent = state.lives;
    
    state.currentQuestionIndex++;
    setTimeout(showNextQuestion, 1000);
}

function showFeedback(isCorrect) {
    const screen = document.getElementById('feedback-screen');
    const msg = document.getElementById('feedback-msg');
    const eyeBase = document.getElementById('feedback-eye-base');
    
    if (screen && msg && eyeBase) {
        // Dynamische Bildauswahl basierend auf Korrektheit
        const correctImages = [
            './assets/images/ack_victory.webp',
            './assets/images/ack_eye_wink.webp',
            './assets/images/ack_hypnotic_opening.webp'
        ];
        const wrongImages = [
            './assets/images/ack_defeat.webp',
            './assets/images/ack_panic_hamster.webp'
        ];

        const selectedImage = isCorrect 
            ? correctImages[Math.floor(Math.random() * correctImages.length)]
            : wrongImages[Math.floor(Math.random() * wrongImages.length)];

        eyeBase.src = selectedImage;
        msg.textContent = isCorrect ? "ACCESS_GRANTED" : "CONNECTION_LOST";
        msg.style.color = isCorrect ? "var(--neon)" : "var(--error)";
        
        screen.classList.add('active');
        
        if (isCorrect) {
            eyeBase.classList.add('zoom-anim');
            if (navigator.vibrate) navigator.vibrate(50);
        } else {
            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        }

        setTimeout(() => {
            screen.classList.remove('active');
            eyeBase.classList.remove('zoom-anim');
        }, 1200);
    }
}

function showLobby() {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('battle-lobby').classList.add('active');
}

function hideLobby() {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('start-screen').classList.add('active');
}

function endGame() {
    const overlay = document.getElementById('modal-overlay');
    const title = document.getElementById('modal-title');
    const text = document.getElementById('modal-text');
    const list = document.getElementById('category-modal-list');
    
    if (overlay) {
        title.textContent = "SESSION_TERMINATED";
        text.textContent = `FINAL_SCORE: ${state.score}_PTS | SECTOR: ${state.selectedCategory}`;
        if (list) list.style.display = "none";
        overlay.style.display = 'flex';
    }
}

function initPWAUpdate() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log("SYSTEM: NEW_VERSION_DETECTED_RELOADING");
            // Optionale Benachrichtigung vor dem Reload
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
