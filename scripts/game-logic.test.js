import { GameLogic } from './game-logic.js';

describe('GameLogic', () => {
  test('calculateScore should return correct base score', () => {
    const score = GameLogic.calculateScore(15, 1);
    expect(score).toBe(130); // 100 base + 0 streak + 30 time (15*2)
  });

  test('calculateScore should include streak bonus', () => {
    const score = GameLogic.calculateScore(10, 3);
    expect(score).toBe(140); // 100 base + 20 streak (2*10) + 20 time (10*2)
  });

  test('shuffle should maintain array length', () => {
    const arr = [1, 2, 3, 4, 5];
    const shuffled = GameLogic.shuffle([...arr]);
    expect(shuffled.length).toBe(arr.length);
    expect(shuffled.sort()).toEqual(arr.sort());
  });

  test('shuffle with seed should be deterministic', () => {
    const arr = [1, 2, 3, 4, 5];
    const seed = 123;
    const shuffled1 = GameLogic.shuffle([...arr], seed);
    const shuffled2 = GameLogic.shuffle([...arr], seed);
    expect(shuffled1).toEqual(shuffled2);
  });
});
