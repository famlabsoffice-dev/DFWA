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
    
    // Disable glitches as requested
    const eyeContainer = document.getElementById('eye-bg-container');
    if (eyeContainer) {
        eyeContainer.style.animation = 'none';
        eyeContainer.style.filter = 'none';
    }
    
    const coreEye = document.getElementById('core-eye');
    if (coreEye) {
        coreEye.style.animation = 'none';
    }

    updateNameDisplay();

    // Category Button
    const categoryBtn = document.getElementById('category-modal-btn');
    if (categoryBtn) {
        categoryBtn.addEventListener('click', showCategoryModal);
    }

    // Add Player Button
    const addPlayerBtn = document.getElementById('add-player-btn');
    if (addPlayerBtn) {
        addPlayerBtn.addEventListener('click', handleAddPlayer);
    }

    // Start Button
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        startBtn.addEventListener('click', startGame);
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
            document.getElementById('current-category-display').textContent = state.selectedCategory.toUpperCase();
        }
    });
}

function updateNameDisplay() {
    const displays = ['player-display', 'stat-player'];
    displays.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (id === 'stat-player') {
                el.innerHTML = `USER_IDENT//<br /><span id="player-display">${state.playerName}</span>`;
            } else {
                el.textContent = state.playerName;
            }
        }
    });
}

function handleAddPlayer() {
    const input = document.getElementById('player-name');
    if (input && input.value.trim()) {
        state.playerName = input.value.trim().toUpperCase();
        localStorage.setItem('dfwa_player_name', state.playerName);
        updateNameDisplay();
        input.value = '';
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
            btn.onclick = () => {
                state.selectedCategory = cat;
                const display = document.getElementById('current-category-display');
                if (display) display.textContent = cat.toUpperCase();
                overlay.style.display = 'none';
            };
            list.appendChild(btn);
        });
        
        overlay.style.display = 'flex';
    }
}

function startGame() {
    if (!window.allQuestions) return;
    
    state.questions = window.allQuestions.filter(q => q.cat === state.selectedCategory);
    // Shuffle questions
    state.questions.sort(() => Math.random() - 0.5);
    
    state.currentQuestionIndex = 0;
    state.score = 0;
    state.lives = 3;
    state.streak = 0;
    
    document.getElementById('start-screen').classList.remove('active');
    document.getElementById('game-screen').classList.add('active');
    
    showNextQuestion();
}

function showNextQuestion() {
    if (state.currentQuestionIndex >= state.questions.length || state.lives <= 0) {
        endGame();
        return;
    }
    
    const q = state.questions[state.currentQuestionIndex];
    const questionText = document.getElementById('question-text');
    const optionsContainer = document.getElementById('options-container');
    const catDisplay = document.getElementById('cat-display');
    
    if (catDisplay) catDisplay.textContent = `SECTOR: ${state.selectedCategory.toUpperCase()}`;
    if (questionText) questionText.textContent = q.text.de || q.text;
    
    if (optionsContainer) {
        optionsContainer.innerHTML = '';
        const options = q.options.de || q.options;
        options.forEach((opt, index) => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.textContent = opt;
            btn.onclick = () => handleAnswer(index === q.correct);
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
        showFeedback(true);
    } else {
        state.lives--;
        state.streak = 0;
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
    if (screen && msg) {
        msg.textContent = isCorrect ? "ACCESS_GRANTED" : "CONNECTION_LOST";
        msg.style.color = isCorrect ? "var(--neon)" : "var(--error)";
        screen.classList.add('active');
        setTimeout(() => screen.classList.remove('active'), 800);
    }
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
        
        const closeBtn = document.getElementById('close-system-btn');
        if (closeBtn) {
            closeBtn.onclick = () => {
                overlay.style.display = 'none';
                document.getElementById('game-screen').classList.remove('active');
                document.getElementById('start-screen').classList.add('active');
            };
        }
    }
}

document.addEventListener('DOMContentLoaded', initStartScreen);
