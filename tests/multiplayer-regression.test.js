import { GameLogic } from '../scripts/game-logic.js';
import crypto from 'node:crypto';
import { TextEncoder, TextDecoder } from 'node:util';

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
global.atob = (str) => Buffer.from(str, 'base64').toString('binary');
global.btoa = (str) => Buffer.from(str, 'binary').toString('base64');

GameLogic._crypto = crypto.webcrypto;

describe('Multiplayer Regression Tests', () => {
  const SECRET = 'DFWA_SYSTEM_SECURE_2026';
  const SEED = 42;
  const SCORE = 1337;

  describe('Challenge Code Lifecycle', () => {
    test('should generate valid challenge code and verify it manually', async () => {
      // 1. Generate Code
      const code = await GameLogic.generateChallengeCode(SEED, SCORE, SECRET);
      expect(code).toBeDefined();
      
      // 2. Decode Code
      const decoded = JSON.parse(atob(code));
      expect(decoded.seed).toBe(SEED);
      expect(decoded.score).toBe(SCORE);
      expect(decoded.auth).toBeDefined();

      // 3. Verify Signature (Server Logic Simulation)
      const msg = JSON.stringify({ seed: SEED, score: SCORE, ts: decoded.ts });
      const expectedAuth = crypto
        .createHmac('sha256', SECRET)
        .update(msg)
        .digest('hex');
      
      expect(decoded.auth).toBe(expectedAuth);
    });

    test('should fail verification if secret is different', async () => {
      const code = await GameLogic.generateChallengeCode(SEED, SCORE, SECRET);
      const decoded = JSON.parse(atob(code));
      
      const wrongSecret = 'WRONG_SECRET';
      const msg = JSON.stringify({ seed: SEED, score: SCORE, ts: decoded.ts });
      const expectedAuthWithWrongSecret = crypto
        .createHmac('sha256', wrongSecret)
        .update(msg)
        .digest('hex');
      
      expect(decoded.auth).not.toBe(expectedAuthWithWrongSecret);
    });

    test('should fail if payload is tampered', async () => {
      const code = await GameLogic.generateChallengeCode(SEED, SCORE, SECRET);
      const decoded = JSON.parse(atob(code));
      
      // Tamper score
      decoded.score = 9999;
      
      const msg = JSON.stringify({ seed: decoded.seed, score: decoded.score, ts: decoded.ts });
      const expectedAuth = crypto
        .createHmac('sha256', SECRET)
        .update(msg)
        .digest('hex');
      
      expect(decoded.auth).not.toBe(expectedAuth);
    });
  });

  describe('Auth Payload Lifecycle', () => {
    test('should generate valid auth payload for leaderboard submission', async () => {
      const playerId = 'TEST_PLAYER_1';
      const mode = 'classic';
      
      const payload = await GameLogic.generateAuthPayload(playerId, SCORE, 5, 2, mode, SECRET);
      
      expect(payload.playerId).toBe(playerId);
      expect(payload.score).toBe(SCORE);
      expect(payload.auth).toBeDefined();
      expect(payload.ts).toBeDefined();

      // Server Logic Simulation
      const msg = JSON.stringify({
        playerId,
        score: SCORE,
        wins: 5,
        losses: 2,
        mode: mode,
        ts: payload.ts,
      });
      const expectedAuth = crypto
        .createHmac('sha256', SECRET)
        .update(msg)
        .digest('hex');
      
      expect(payload.auth).toBe(expectedAuth);
    });
  });
});
