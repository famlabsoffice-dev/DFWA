export const UIManager = {
  setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  },

  setHTML(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  },

  toggleClass(id, className, force) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle(className, force);
  },

  showModal(title, text, color = 'var(--neon)') {
    const overlay = document.getElementById('modal-overlay');
    const titleEl = document.getElementById('modal-title');
    const textEl = document.getElementById('modal-text');

    if (overlay) overlay.style.display = 'flex';
    if (titleEl) {
      titleEl.textContent = title;
      titleEl.style.color = color;
    }
    if (textEl) textEl.textContent = text;
  },

  renderLeaderboard(entriesDiv, data) {
    if (!entriesDiv) return;
    entriesDiv.replaceChildren();

    data.forEach((entry, index) => {
      const row = document.createElement('div');
      row.className = 'leaderboard-entry';

      const rankSpan = document.createElement('span');
      rankSpan.textContent = `#${index + 1}`;

      const nameSpan = document.createElement('span');
      nameSpan.textContent = entry.playerName;

      const scoreSpan = document.createElement('span');
      scoreSpan.textContent = String(entry.score);

      const statsSpan = document.createElement('span');
      statsSpan.textContent = `${entry.wins}/${entry.losses}`;

      row.append(rankSpan, nameSpan, scoreSpan, statsSpan);
      entriesDiv.appendChild(row);
    });
  }
};
