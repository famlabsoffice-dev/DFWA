import { StorageManager } from './scripts/storage.js';
import { GameLogic } from './scripts/game-logic.js';
import { UIManager } from './scripts/ui-manager.js';
import { APIClient } from './scripts/api-client.js';
import { STORAGE_KEYS, SYSTEM_MESSAGES, GAME_MODES } from './scripts/constants.js';

const API_BASE_URL = window.location.origin;
let state = { lang: 'de', questions: [], allQuestions: [], current: 0, score: 0, lives: 3, systemSecret: null };

async function initApp() {
    try {
        state.systemSecret = await APIClient.fetchSecret(API_BASE_URL);
        state.lang = localStorage.getItem('dfwa_lang') || 'de';
    } catch (e) {
        console.error("Init failed", e);
    }
}

function setupEventListeners() {
    document.getElementById('start-btn')?.addEventListener('click', () => initGame(false));
    document.getElementById('lobby-btn')?.addEventListener('click', () => {
        UIManager.toggleClass('start-screen', 'active', false);
        UIManager.toggleClass('battle-lobby', 'active', true);
    });
}

async function initGame(createChallenge) {
    UIManager.updateElement('question-text', 'LOADING...');
    try {
        const [qRes, cRes] = await Promise.all([fetch("./questions_i18n.json"), fetch("./ack_comments.json")]);
        state.allQuestions = await qRes.json();
        state.comments = await cRes.json();
        state.questions = GameLogic.shuffle([...state.allQuestions]);
        
        UIManager.toggleClass('start-screen', 'active', false);
        UIManager.toggleClass('game-screen', 'active', true);
        renderQuestion();
    } catch (error) {
        UIManager.updateElement('question-box', 'ERROR_LOADING_DATA');
    }
}

function renderQuestion() {
    if (state.questions.length === 0) return;
    const q = state.questions[state.current];
    UIManager.updateElement('question-box', q.text[state.lang]);
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

function checkAnswer(correct) {
    state.current++;
    if (state.current < state.questions.length) renderQuestion();
    else UIManager.updateElement('question-box', 'GAME_OVER');
}

initApp().finally(() => setupEventListeners());
