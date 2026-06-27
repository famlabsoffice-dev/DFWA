export const UIManager = {
    updateElement(id, text) {
        const el = document.getElementById(id);
        if (el) el.innerText = text;
    },

    updateHTML(id, html) {
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
            titleEl.innerText = title;
            titleEl.style.color = color;
        }
        if (textEl) textEl.innerText = text;
    },

    renderLeaderboard(entriesDiv, data) {
        entriesDiv.innerHTML = '';
        data.forEach((entry, index) => {
            const row = document.createElement('div');
            row.className = 'leaderboard-entry';
            row.innerHTML = `
                <span>#${index + 1}</span>
                <span>${entry.playerName}</span>
                <span>${entry.score}</span>
                <span>${entry.wins}/${entry.losses}</span>
            `;
            entriesDiv.appendChild(row);
        });
    }
};
