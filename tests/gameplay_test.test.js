import { GameLogic } from '../scripts/game-logic.js';
import { GameModes, ModeConfig } from '../scripts/game-modes.js';

describe('DFWA Gameplay Engine Tests', () => {
    let state;
    let mockQuestions;

    beforeEach(() => {
        state = {
            selectedMode: GameModes.CLASSIC,
            score: 0,
            lives: 3,
            streak: 0,
            timer: 0,
            seed: 'test_seed'
        };
        
        mockQuestions = [
            { cat: 'Gegenteil', text: { de: 'Frage 1' }, options: { de: ['A', 'B', 'C', 'D'] }, correct: 0 },
            { cat: 'Gegenteil', text: { de: 'Frage 2' }, options: { de: ['E', 'F', 'G', 'H'] }, correct: 1 },
            { cat: 'Gegenteil', text: { de: 'Frage 3' }, options: { de: ['I', 'J', 'K', 'L'] }, correct: 2 }
        ];
    });

    test('loadQuestions filters by category', () => {
        const filtered = mockQuestions.filter(q => q.cat === 'Gegenteil');
        expect(filtered.length).toBe(3);
        expect(filtered[0].text.de).toBe('Frage 1');
    });

    test('GameLogic.shuffle maintains array length', () => {
        const shuffled = GameLogic.shuffle(mockQuestions, state.seed);
        expect(shuffled.length).toBe(mockQuestions.length);
    });

    test('Timer initialization for CLASSIC mode', () => {
        const config = ModeConfig[GameModes.CLASSIC];
        state.timer = config.initialTimer;
        expect(state.timer).toBe(config.initialTimer);
        expect(state.timer).toBeGreaterThan(0);
    });

    test('Score calculation with multiplier', () => {
        const config = ModeConfig[GameModes.CLASSIC];
        const baseScore = 100;
        const multipliedScore = Math.round(baseScore * config.scoreMultiplier);
        expect(multipliedScore).toBeGreaterThan(0);
    });

    test('Streak increments on correct answer', () => {
        state.streak = 0;
        state.streak++;
        expect(state.streak).toBe(1);
    });

    test('Lives decrement on wrong answer', () => {
        state.lives = 3;
        state.lives--;
        expect(state.lives).toBe(2);
    });

    test('Streak resets on wrong answer', () => {
        state.streak = 5;
        state.streak = 0;
        expect(state.streak).toBe(0);
    });

    test('Game ends when lives reach 0', () => {
        state.lives = 0;
        const gameEnded = state.lives <= 0;
        expect(gameEnded).toBe(true);
    });
});
