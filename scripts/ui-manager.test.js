import { UIManager } from './ui-manager.js';

describe('UIManager', () => {
  beforeEach(() => {
    document.body.innerHTML = `
            <div id="test-el"></div>
            <div id="modal-overlay" style="display: none;">
                <div id="modal-title"></div>
                <div id="modal-text"></div>
            </div>
            <div id="leaderboard-entries"></div>
        `;
  });

  test('setText updates textContent', () => {
    UIManager.setText('test-el', 'new text');
    expect(document.getElementById('test-el').textContent).toBe('new text');
  });

  test('toggleClass toggles class correctly', () => {
    UIManager.toggleClass('test-el', 'active', true);
    expect(document.getElementById('test-el').classList.contains('active')).toBe(true);
    UIManager.toggleClass('test-el', 'active', false);
    expect(document.getElementById('test-el').classList.contains('active')).toBe(false);
  });

  test('showModal displays modal with content', () => {
    UIManager.showModal('Title', 'Message', '#ff0000');
    const overlay = document.getElementById('modal-overlay');
    expect(overlay.style.display).toBe('flex');
    expect(document.getElementById('modal-title').textContent).toBe('Title');
    expect(document.getElementById('modal-title').style.color).toBe('rgb(255, 0, 0)');
    expect(document.getElementById('modal-text').textContent).toBe('Message');
  });

  test('renderLeaderboard renders entries', () => {
    const data = [
      { playerName: 'Alice', score: 100, wins: 5, losses: 1 },
      { playerName: 'Bob', score: 80, wins: 3, losses: 2 },
    ];
    const container = document.getElementById('leaderboard-entries');
    UIManager.renderLeaderboard(container, data);

    const entries = container.querySelectorAll('.leaderboard-entry');
    expect(entries.length).toBe(2);
    expect(entries[0].innerHTML).toContain('Alice');
    expect(entries[0].innerHTML).toContain('100');
  });
});
