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
    pausedQuestion: null, pausedTimer: null, cheatsAttempted: false,
    systemSecret: null
};

async function fetchSystemSecret() {
  try {
    const res = await fetch(`${API_BASE_URL}/config/secret`);
    if (res.ok) {
      const data = await res.json();
      state.systemSecret = data.secret;
    } else {
      // Offline-Modus: Kein Secret vom Server verfügbar.
      // Lokale Signaturen dienen nur der UI-Konsistenz, nicht der Sicherheit.
      state.systemSecret = 'LOCAL_ONLY_UNTRUSTED';
    }
  } catch (e) {
    state.systemSecret = 'LOCAL_ONLY_UNTRUSTED';
  }
  await validateStorage();
}
fetchSystemSecret();

async function getSignature(data) {
    // Hinweis: Client-seitige Signaturen sind im Offline-Modus manipulierbar.
    // Echte Verifizierung erfolgt nur über den Server-Secret.
    const key = await crypto.subtle.importKey(
        'raw', new TextEncoder().encode(state.systemSecret || 'LOCAL_ONLY_UNTRUSTED'),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
    return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2,'0')).join('');
}

async function saveSecure(key, value) {
    localStorage.setItem(key, value);
    const sig = await getSignature(value.toString());
    localStorage.setItem(`${key}_sig`, sig);
}

async function validateStorage() {
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
    document.getElementById('high-score').innerText = state.best;
    document.getElementById('battle-stats').innerText = `W:${state.wins} / L:${state.losses}`;
}

function detectLanguage() {
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
}

function updateUIForLanguage() {
    document.documentElement.lang = state.lang;
    const startBtn = document.getElementById('start-btn');
    if (startBtn) startBtn.innerText = state.lang === 'de' ? 'PROTOKOLL_STARTEN' : 'INIT_PROTOCOL';
    
    const playerDisplay = document.getElementById('player-display');
    if (playerDisplay) playerDisplay.innerText = state.playerName;
    
    const idDisplay = document.getElementById('id-display');
    if (idDisplay) idDisplay.innerText = state.playerId;
    
    const highScore = document.getElementById('high-score');
    if (highScore) highScore.innerText = state.best;
    
    const battleStats = document.getElementById('battle-stats');
    if (battleStats) battleStats.innerText = `W:${state.wins} / L:${state.losses}`;
    
    const playerNameInput = document.getElementById('player-name');
    if (playerNameInput) playerNameInput.value = state.playerName !== 'GUEST' ? state.playerName : '';
}

function setLanguage(lang) {
    state.lang = lang;
    localStorage.setItem('dfwa_lang', lang);
    updateUIForLanguage();
}
detectLanguage();

function showLobby() {
    state.playerName = document.getElementById('player-name').value.trim() || 'GUEST';
    saveSecure('dfwa_name', state.playerName);
    document.getElementById('start-screen').classList.remove('active');
    document.getElementById('battle-lobby').classList.add('active');
}

function hideLobby() {
    document.getElementById('battle-lobby').classList.remove('active');
    document.getElementById('start-screen').classList.add('active');
}

async function startChallenge() {
    const code = document.getElementById('challenge-code-input').value.trim();
    if (code) {
        try {
            const data = JSON.parse(atob(code));
            if (!data.seed || data.score === undefined || !data.sig) throw new Error();
            
            // Verifizierung der Signatur
            const payload = { seed: data.seed, score: data.score, ts: data.ts };
            const expectedSig = (await getSignature(JSON.stringify(payload))).slice(0, 16);
            
            if (data.sig !== expectedSig) {
                console.warn("CHALLENGE_INTEGRITY_FAIL: Code tampered or generated with different secret.");
            }

            const age = Date.now() - (data.ts || 0);
            if (age > 86400000) throw new Error('EXPIRED');
            state.isChallenge = true;
            state.challengeSeed = data.seed;
            state.opponentScore = data.score;
            initGame(false);
        } catch(e) {
            const inp = document.getElementById('challenge-code-input');
            inp.value = '';
            inp.placeholder = e.message === 'EXPIRED' ? (state.lang === 'de' ? 'CODE_ABGELAUFEN — ERNEUT VERSUCHEN' : 'CODE_EXPIRED — RETRY') : (state.lang === 'de' ? 'UNGÜLTIGER CODE — ERNEUT VERSUCHEN' : 'INVALID_CODE — RETRY');
            setTimeout(() => { inp.placeholder = (state.lang === 'de' ? 'HERAUSFORDERUNGSCODE EINGEBEN' : 'ENTER_CHALLENGE_CODE'); }, 2000);
        }
    } else {
        initGame(true);
    }
}

async function generateChallengeCode() {
    const seed = Math.floor(Math.random() * 1000000);
    const payload = { seed, score: state.score, ts: Date.now() };
    const msg = JSON.stringify(payload);
    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(state.systemSecret || 'DFWA_SECRET_ACK'),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
    const sigHex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2,'0')).join('').slice(0, 16);
    return btoa(JSON.stringify({ ...payload, sig: sigHex }));
}

function shuffle(array, seed) {
    let m = array.length, t, i;
    while (m) {
        i = Math.floor((seed ? (Math.sin(seed++) * 10000) % 1 : Math.random()) * m--);
        t = array[m]; array[m] = array[i]; array[i] = t;
    }
    return array;
}

function pauseProtocol() {
    state.isPaused = true;
    state.cheatsAttempted = false;
    state.pausedQuestion = state.current;
    state.pausedTimer = state.timer;
    clearInterval(state.timerInterval);
    document.getElementById('game-screen').classList.remove('active');
    document.getElementById('start-screen').classList.add('active');
    document.getElementById('resume-btn').style.display = 'block';
}

function resumeProtocol() {
    if (state.cheatsAttempted) {
        const btn = document.getElementById('resume-btn');
        btn.innerText = state.lang === 'de' ? 'CHEAT_ERKANNT — NEUSTART' : 'CHEAT_DETECTED — REBOOT';
        setTimeout(() => {
            btn.innerText = 'RESUME_PROTOCOL';
            initGame(false);
        }, 1500);
        return;
    }
    state.isPaused = false;
    document.getElementById('start-screen').classList.remove('active');
    document.getElementById('game-screen').classList.add('active');
    document.getElementById('resume-btn').style.display = 'none';
    state.timer = (state.pausedTimer !== null && state.pausedTimer > 0) ? state.pausedTimer : 15;
    state.pausedTimer = null;
    startTimer();
}

async function initGame(createChallenge) {
    state.playerName = document.getElementById("player-name").value.trim() || "GUEST";
    saveSecure("dfwa_name", state.playerName);
    state.lives = 3; state.current = 0; state.score = 0; state.questionCount = 0; state.streak = 0; state.streakMax = 0; state.correctAnswers = 0; state.isChallenge = false; state.isCreatingChallenge = createChallenge; state.isPaused = false; state.cheatsAttempted = false; state.pausedTimer = null;
    document.getElementById('lives-display').innerText = state.lives;
    document.getElementById('resume-btn').style.display = 'none';
    state.usedComments = { correct: [], incorrect: [] };

    try {
        const cRes = await fetch("ack_comments.json");
        if (!cRes.ok) throw new Error("FETCH_FAILED");
        state.comments = await cRes.json();

        let allQuestions = window._dfwaQCache;
        if (!allQuestions) {
            const qRes = await fetch("questions_i18n.json");
            if (!qRes.ok) throw new Error("FETCH_FAILED");
            allQuestions = await qRes.json();
            window._dfwaQCache = allQuestions;
        }
        state.allQuestions = allQuestions;
        populateCategories(allQuestions);

        const selectedCat = document.getElementById("category-filter").value;
        if (selectedCat !== "all") {
            allQuestions = allQuestions.filter(q => q.cat === selectedCat);
        }
        if (allQuestions.length === 0) throw new Error("NO_QUESTIONS");

        state.questions = shuffle([...allQuestions], state.isChallenge ? state.challengeSeed : null);

        document.getElementById("start-screen").classList.remove("active");
        document.getElementById("battle-lobby").classList.remove("active");
        document.getElementById("game-screen").classList.add("active");
        document.getElementById("hud-score").innerText = "0_PTS";
        document.getElementById("hud-streak").style.display = "none";
        document.getElementById('modal-title').style.color = 'var(--warning)';
        document.getElementById('modal-overlay').style.display = 'none';
        renderQuestion();
    } catch(e) {
        document.getElementById("start-btn").innerText =
            e.message === "NO_QUESTIONS" ? (state.lang === "de" ? "FEHLER: LEERER SEKTOR" : "ERROR: EMPTY_SECTOR") : (state.lang === "de" ? "FEHLER: SYSTEM OFFLINE" : "ERROR: SYSTEM_OFFLINE");
        setTimeout(() => {
            document.getElementById("start-btn").innerText =
                state.lang === "de" ? "PROTOKOLL_STARTEN" : "INIT_PROTOCOL";
        }, 3000);
    }
}

function populateCategories(questions) {
    const cats = [...new Set(questions.map(q => q.cat))].sort();
    const filter = document.getElementById('category-filter');
    const currentVal = filter.value;
    filter.innerHTML = `<option value="all">${state.lang === 'de' ? 'ALLE_SEKTOREN' : 'ALL_SECTORS'}</option>`;
    cats.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.innerText = cat.toUpperCase();
        filter.appendChild(opt);
    });
    if ([...filter.options].some(o => o.value === currentVal)) {
        filter.value = currentVal;
    }
}

async function loadCategories() {
    try {
        if (!window._dfwaQCache) {
            const res = await fetch('questions_i18n.json');
            if (!res.ok) return;
            window._dfwaQCache = await res.json();
        }
        populateCategories(window._dfwaQCache);
    } catch(e) {}
}
loadCategories();

function startTimer() {
    clearInterval(state.timerInterval);
    const bar = document.getElementById('timeline-bar');
    const container = document.getElementById('timeline-container');
    state.timerInterval = setInterval(() => {
        state.timer -= 0.1;
        const maxTime = Math.max(5, 15 - ((state.questionCount - 1) * 0.2));
        const pct = Math.max(0, state.timer / maxTime * 100);
        bar.style.width = pct + '%';
        bar.style.background = state.timer <= 5 ? 'var(--error)' : 'var(--neon)';
        container.setAttribute('aria-valuenow', Math.round(state.timer));
        if (state.timer <= 0) { clearInterval(state.timerInterval); checkAnswer(null); }
    }, 100);
}

function renderQuestion() {
    const q = state.questions[state.current];
    if (!q) {
        const selectedCat = document.getElementById('category-filter').value;
        let pool = state.allQuestions;
        if (selectedCat !== 'all') {
            pool = state.allQuestions.filter(q => q.cat === selectedCat);
        }
        if (pool.length === 0) pool = state.allQuestions;
        state.questions = shuffle([...pool], null);
        state.current = 0;
        if (state.questions.length === 0) {
            endGame();
            return;
        }
        renderQuestion();
        return;
    }
    state.questionCount++;
    state.timer = Math.max(5, 15 - (state.questionCount * 0.2));
    document.getElementById('question-box').innerText = q.text[state.lang];
    const container = document.getElementById('options-container');
    container.innerHTML = '';
    q.options[state.lang].forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerText = opt;
        btn.setAttribute('aria-label', `Option ${i + 1}: ${opt}`);
        btn.onclick = () => checkAnswer(i === q.correct);
        container.appendChild(btn);
    });
    startTimer();
}

async function submitScoreToLeaderboard() {
    try {
        const payload = {
            playerName: state.playerName,
            playerId: state.playerId,
            score: state.score,
            accuracy: state.questionCount > 0 ? Math.round((state.correctAnswers / state.questionCount) * 100) : 0,
            streakMax: state.streakMax,
            timestamp: new Date().toISOString()
        };
        const res = await fetch(`${API_BASE_URL}/leaderboard/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) console.log('Score submitted to leaderboard');
    } catch (e) {
        console.log('Leaderboard submission failed (offline mode)');
    }
}

function endGame() {
    clearInterval(state.timerInterval);
    const overlay = document.getElementById('modal-overlay');
    const text = document.getElementById('modal-text');
    const title = document.getElementById('modal-title');

    const isNewBest = state.score > state.best;
    document.getElementById('lives-display').innerText = state.lives;
    if (isNewBest) {
        state.best = state.score;
        saveSecure('dfwa_best', state.best);
        document.getElementById('high-score').innerText = state.best;
        submitScoreToLeaderboard();
    }

    overlay.style.display = 'flex';

    if (state.isCreatingChallenge) {
        title.innerText = "CHALLENGE_CREATED";
        text.innerText = "GENERATING...";
        generateChallengeCode().then(code => { text.innerText = code; });
    } else if (state.isChallenge) {
        const win = state.score > state.opponentScore;
        title.style.color = win ? 'var(--neon)' : 'var(--error)';
        title.innerText = win ? "VICTORY" : "DEFEAT";
        text.innerText = `YOUR_SCORE: ${state.score}\nOPPONENT: ${state.opponentScore}\nDIFF: ${state.score - state.opponentScore > 0 ? '+' : ''}${state.score - state.opponentScore}`;
        if (win) { state.wins++; saveSecure('dfwa_wins', state.wins); }
        else { state.losses++; saveSecure('dfwa_losses', state.losses); }
        document.getElementById('battle-stats').innerText = `W:${state.wins} / L:${state.losses}`;
    } else {
        title.style.color = isNewBest ? 'var(--warning)' : 'var(--neon)';
        title.innerText = isNewBest ? "NEW_PEAK_DATA" : "PROTOCOL_COMPLETE";
        const accuracy = state.questionCount > 0 ? Math.round((state.correctAnswers / state.questionCount) * 100) : 0;
        text.innerText = `FINAL_SCORE: ${state.score}\nPEAK_DATA: ${state.best}\nSTREAK_MAX: ${state.streakMax}\nACCURACY: ${accuracy}%`;
    }
}

function getComment(type) {
    let pool = state.comments[state.lang][type];
    let available = pool.filter(c => !state.usedComments[type].includes(c));
    if (available.length === 0) {
        state.usedComments[type] = [];
        available = pool;
    }
    let choice = available[Math.floor(Math.random() * available.length)];
    state.usedComments[type].push(choice);
    return choice;
}

function checkAnswer(correct) {
    if (state.isProcessing) return;
    state.isProcessing = true;
    clearInterval(state.timerInterval);
    const fScreen = document.getElementById('feedback-screen');
    const fContainer = document.getElementById('feedback-eye-container');
    const fEyeBase = document.getElementById('feedback-eye-base');
    const fMsg = document.getElementById('feedback-msg');

    fContainer.classList.remove('zoom-anim');
    
    if (correct) {
        state.streak++;
        state.correctAnswers++;
        if (state.streak > state.streakMax) state.streakMax = state.streak;
        const streakBonus = Math.min((state.streak - 1) * 10, 100);
        const timeBonus = Math.min(Math.floor(state.timer * 2), 30);
        state.score += 100 + streakBonus + timeBonus;
        document.getElementById("hud-score").innerText = `${state.score}_PTS`;
        const hudStreak = document.getElementById("hud-streak");
        if (state.streak >= 2) {
          hudStreak.style.display = "inline";
          document.getElementById("hud-streak-count").innerText = state.streak;
        } else {
          hudStreak.style.display = "none";
        }
        fEyeBase.src = './assets/images/ack_core_clean.png';
        let blinkCount = 0;
        const blinkInt = setInterval(() => {
            fEyeBase.src = blinkCount % 2 === 0 ? './assets/images/ack_core_closed_clean.png' : './assets/images/ack_core_clean.png';
            blinkCount++;
            if (blinkCount > 3) clearInterval(blinkInt);
        }, 150);
        fMsg.style.borderColor = 'var(--neon)';
        fMsg.style.color = 'var(--neon)';
        fMsg.innerText = getComment('correct');
    } else if (correct === false) {
        state.lives = Math.max(0, state.lives - 1);
        state.streak = 0;
        document.getElementById("hud-streak").style.display = "none";
        document.getElementById("lives-display").innerText = state.lives;
        fEyeBase.src = './assets/images/ack_core_clean.png';
        fContainer.classList.add('zoom-anim');
        fMsg.style.borderColor = 'var(--error)';
        fMsg.style.color = 'var(--error)';
        fMsg.innerText = getComment('incorrect');
    } else {
        fEyeBase.src = './assets/images/ack_core_clean.png';
        fMsg.style.borderColor = 'var(--warning)';
        fMsg.style.color = 'var(--warning)';
        fMsg.innerText = state.lang === 'de' ? 'ZEIT ABGELAUFEN!' : 'TIME EXPIRED!';
    }

    fScreen.classList.add('active');
    setTimeout(() => {
        fScreen.classList.remove('active');
        state.isProcessing = false;
        if (state.lives <= 0) {
            document.getElementById('start-screen').classList.add('active');
            document.getElementById('game-screen').classList.remove('active');
            document.getElementById('lives-display').innerText = state.lives;
            endGame();
        } else {
            state.current++;
            renderQuestion();
        }
    }, 3500);
}

setInterval(() => {
    if (document.getElementById('start-screen').classList.contains('active')) {
        const eye = document.getElementById('core-eye');
        eye.src = './assets/images/ack_core_closed_clean.png';
        setTimeout(() => eye.src = './assets/images/ack_core_clean.png', 150);
    }
}, 4000);

document.addEventListener('keydown', (e) => {
    if (state.isPaused) {
        if (!['Enter', ' ', 'Tab', 'Escape'].includes(e.key)) {
            state.cheatsAttempted = true;
            return;
        }
    }
    if (state.isProcessing) return;
    if (!document.getElementById('game-screen').classList.contains('active')) return;
    const map = { '1': 0, '2': 1, '3': 2, '4': 3 };
    if (map[e.key] !== undefined) {
        const btns = document.getElementById('options-container').querySelectorAll('.option-btn');
        if (btns[map[e.key]]) btns[map[e.key]].click();
    }
});

document.addEventListener('contextmenu', (e) => {
    if (state.isPaused) {
        e.preventDefault();
        state.cheatsAttempted = true;
    }
});

async function fetchLeaderboard() {
    try {
        const res = await fetch(`${API_BASE_URL}/leaderboard/top?limit=10`);
        if (res.ok) {
            const data = await res.json();
            displayLeaderboard(data);
        }
    } catch (e) {
        console.log('Leaderboard fetch failed (offline mode)');
    }
}

function displayLeaderboard(scores) {
    let lb = '<div style="font-size: 0.8rem; text-align: left; margin-top: 10px; max-height: 200px; overflow-y: auto;">';
    scores.forEach((entry, idx) => {
        lb += `<div>${idx + 1}. ${entry.playerName}: ${entry.score}pts</div>`;
    });
    lb += '</div>';
    const text = document.getElementById('modal-text');
    if (text) text.innerHTML += lb;
}

function closeSystem() {
    document.getElementById('modal-overlay').style.display = 'none';
    document.getElementById('modal-title').style.color = 'var(--warning)';
    document.getElementById('game-screen').classList.remove('active');
    document.getElementById('start-screen').classList.add('active');
    state.isChallenge = false;
    state.isCreatingChallenge = false;
    state.streak = 0;
    state.streakMax = 0;
    state.correctAnswers = 0;
    state.lives = 3;
    document.getElementById('lives-display').innerText = state.lives;
    document.getElementById('high-score').innerText = state.best;
    document.getElementById('hud-score').innerText = '0_PTS';
    document.getElementById('hud-streak').style.display = 'none';
    fetchLeaderboard();
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden && document.getElementById('game-screen').classList.contains('active') && !state.isPaused) {
        pauseProtocol();
    }
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then(reg => {
            reg.addEventListener('updatefound', () => {
                const newWorker = reg.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // Neuer SW ist bereit, wartet aber noch
                        console.log('New Service Worker available.');
                    }
                });
            });
        }).catch(err => console.error('SW registration failed:', err));
    });

    navigator.serviceWorker.addEventListener('message', event => {
        if (event.data && event.data.type === 'SW_UPDATED') {
            console.log(`System updated to ${event.data.version}. Reloading...`);
            // Automatischer Reload nach Update (PWA-konform)
            window.location.reload();
        }
    });
}
