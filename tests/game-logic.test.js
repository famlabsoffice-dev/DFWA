import { GameLogic } from '../scripts/game-logic.js';
import crypto from 'node:crypto';
import { TextEncoder, TextDecoder } from 'node:util';

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

GameLogic._crypto = crypto.webcrypto;

describe('GameLogic', () => {
  describe('calculateScore', () => {
    test('should calculate base score correctly', () => {
      expect(GameLogic.calculateScore(0, 1)).toBe(100);
    });

    test('should include streak bonus', () => {
      // 100 + min((2-1)*10, 100) + 0 = 110
      expect(GameLogic.calculateScore(0, 2)).toBe(110);
      // 100 + min((11-1)*10, 100) + 0 = 200
      expect(GameLogic.calculateScore(0, 11)).toBe(200);
      // Streak bonus capped at 100: 100 + 100 + 0 = 200
      expect(GameLogic.calculateScore(0, 20)).toBe(200);
    });

    test('should include time bonus', () => {
      // 100 + 0 + min(5*2, 30) = 110
      expect(GameLogic.calculateScore(5, 1)).toBe(110);
      // 100 + 0 + min(15*2, 30) = 130
      expect(GameLogic.calculateScore(15, 1)).toBe(130);
      // Time bonus capped at 30: 100 + 0 + 30 = 130
      expect(GameLogic.calculateScore(20, 1)).toBe(130);
    });

    test('should combine bonuses correctly', () => {
      // 100 + 10 + 20 = 130
      expect(GameLogic.calculateScore(10, 2)).toBe(130);
    });
  });

  describe('shuffle', () => {
    test('should shuffle array', () => {
      const input = [1, 2, 3, 4, 5];
      const result = GameLogic.shuffle([...input]);
      expect(result).toHaveLength(input.length);
      expect(result.sort()).toEqual(input.sort());
    });

    test('should be deterministic with seed', () => {
      const input = [1, 2, 3, 4, 5];
      const seed = 12345;
      const result1 = GameLogic.shuffle([...input], seed);
      const result2 = GameLogic.shuffle([...input], seed);
      expect(result1).toEqual(result2);
    });
  });

  describe('generateChallengeCode', () => {
    test('should generate a base64 string', async () => {
      const seed = 1;
      const score = 100;
      const secret = 'test-secret';
      const code = await GameLogic.generateChallengeCode(seed, score, secret);
      expect(typeof code).toBe('string');
      expect(() => atob(code)).not.toThrow();
    });

    test('should throw error if secret is missing', async () => {
      await expect(GameLogic.generateChallengeCode(1, 100)).rejects.toThrow(
        'SYSTEM_SECRET not provided for GameLogic'
      );
    });
  });
});
