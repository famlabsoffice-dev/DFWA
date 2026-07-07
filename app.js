/**
 * DFWA - Start Screen Fixes
 * - Removes Glitches
 * - Fixes Name Display
 * - Fixes Category Modal
 * - Removes Server Room Button from Start Screen
 */

const state = {
    playerName: localStorage.getItem('dfwa_player_name') || 'GUEST',
    selectedCategory: 'CLASSIC'
};

function initStartScreen() {
    console.log("Initializing Start Screen...");
    
    // 1. Remove Glitches: Stop the eye-bg animation and other glitch effects
    const eyeContainer = document.getElementById('eye-bg-container');
    if (eyeContainer) {
        eyeContainer.style.animation = 'none';
        eyeContainer.style.filter = 'none';
    }
    
    const coreEye = document.getElementById('core-eye');
    if (coreEye) {
        coreEye.style.animation = 'none';
    }

    // 2. Fix Name Display: Sync UI with state
    updateNameDisplay();

    // 3. Category Modal Fix: Add Event Listeners
    const categoryBtn = document.getElementById('category-modal-btn');
    if (categoryBtn) {
        categoryBtn.addEventListener('click', showCategoryModal);
    }

    const addPlayerBtn = document.getElementById('add-player-btn');
    if (addPlayerBtn) {
        addPlayerBtn.addEventListener('click', handleAddPlayer);
    }

    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            console.log("Starting protocol with category:", state.selectedCategory);
            // Game start logic would go here
        });
    }

    // 4. Remove Server Room Button (it's in battle lobby already)
    // Note: In index.html, it's actually 'show-leaderboard-btn' or similar.
    // Based on the grep, there's a button with id="show-leaderboard-btn" in battle-lobby
    // and potentially one in start-screen if it was added.
    // Let's check for any leaderboard button on start screen.
    const startLeaderboardBtn = document.getElementById('start-show-leaderboard-btn');
    if (startLeaderboardBtn) {
        startLeaderboardBtn.remove();
    }
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
        console.log("Player updated:", state.playerName);
    }
}

function showCategoryModal() {
    const overlay = document.getElementById('modal-overlay');
    const title = document.getElementById('modal-title');
    const list = document.getElementById('category-modal-list');
    const text = document.getElementById('modal-text');
    
    if (overlay && list) {
        title.textContent = "SELECT_CATEGORY";
        text.textContent = "Choose your operational realm:";
        list.style.display = "grid";
        list.innerHTML = ''; // Clear
        
        const categories = ['CLASSIC', 'HARDWARE', 'AI_CORE', 'SECURITY'];
        categories.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = 'mode-btn';
            if (cat === state.selectedCategory) btn.classList.add('active');
            btn.textContent = cat;
            btn.onclick = () => {
                state.selectedCategory = cat;
                document.getElementById('current-category-display').textContent = cat;
                overlay.style.display = 'none';
                console.log("Category selected:", cat);
            };
            list.appendChild(btn);
        });
        
        overlay.style.display = 'flex';
    }
}

// Run on load
document.addEventListener('DOMContentLoaded', initStartScreen);
