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
    const profileView = document.getElementById('profile-view');
    const categoryList = document.getElementById('category-modal-list');

    if (overlay) overlay.style.display = 'flex';
    if (titleEl) {
      titleEl.textContent = title;
      titleEl.style.color = color;
    }
    if (textEl) {
      textEl.textContent = text;
      textEl.style.display = text ? 'block' : 'none';
    }
    if (profileView) profileView.style.display = 'none';
    if (categoryList) categoryList.style.display = 'none';
  },

  showProfile(data) {
    const overlay = document.getElementById('modal-overlay');
    const profileView = document.getElementById('profile-view');
    const titleEl = document.getElementById('modal-title');
    const textEl = document.getElementById('modal-text');
    const categoryList = document.getElementById('category-modal-list');

    if (!overlay || !profileView) return;

    this.setText('prof-name', data.playerName || 'GUEST');
    this.setText('prof-league', data.league || 'BRONZE');
    this.setText('prof-elo', data.elo || '1000');
    this.setText('prof-score', data.score || '0');
    this.setText('prof-stats', `${data.wins || 0}/${data.losses || 0}`);
    this.setText('prof-accuracy', `${data.accuracy || 0}%`);

    const achContainer = document.getElementById('prof-achievements');
    if (achContainer) {
      achContainer.innerHTML = '';
      (data.achievements || []).forEach((achName, index) => {
        const tag = document.createElement('span');
        tag.className = 'achievement-tag';
        tag.style.cssText = `background: rgba(0, 255, 255, 0.1); border: 1px solid var(--cyber-blue); padding: 6px 10px; border-radius: 4px; font-size: 0.7rem; color: var(--cyber-blue); display: flex; align-items: center; gap: 8px; animation-delay: ${index * 0.1}s;`;
        
        const iconMap = {
          'First Win': '🏆',
          'Novice Hacker': '⚡',
          'Code Breaker': '🔓',
          'Elite Operative': '💎',
          'System Survivor': '💀'
        };
        
        tag.innerHTML = `<span style="font-size: 1rem;">${iconMap[achName] || '🎖️'}</span> ${achName}`;
        achContainer.appendChild(tag);
      });
    }

    if (titleEl) {
      titleEl.textContent = 'PLAYER_PROFILE';
      titleEl.style.color = 'var(--cyber-blue)';
    }
    if (textEl) textEl.style.display = 'none';
    if (categoryList) categoryList.style.display = 'none';
    
    profileView.style.display = 'block';
    overlay.style.display = 'flex';
  },

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `achievement-toast toast-${type}`;
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.zIndex = '9999';
    toast.innerText = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  },

  renderLeaderboard(entriesDiv, data) {
    if (!entriesDiv) return;
    entriesDiv.replaceChildren();

    data.forEach((entry, index) => {
      const row = document.createElement('div');
      row.className = 'leaderboard-entry animate';
      row.style.animationDelay = `${index * 0.05}s`;
      row.style.display = 'grid';
      row.style.gridTemplateColumns = '0.5fr 1.5fr 1fr 1fr';
      row.style.alignItems = 'center';

      const rankSpan = document.createElement('span');
      rankSpan.textContent = `#${index + 1}`;

      const nameContainer = document.createElement('div');
      nameContainer.style.display = 'flex';
      nameContainer.style.flexDirection = 'column';
      
      const nameSpan = document.createElement('span');
      nameSpan.textContent = entry.playerName;
      nameSpan.style.fontWeight = '900';
      
      const leagueSpan = document.createElement('span');
      leagueSpan.textContent = `${entry.league || 'BRONZE'} [${entry.elo || 1000}]`;
      leagueSpan.style.fontSize = '0.5rem';
      leagueSpan.style.color = 'var(--cyber-blue)';
      
      nameContainer.append(nameSpan, leagueSpan);

      const scoreSpan = document.createElement('span');
      scoreSpan.textContent = String(entry.score);

      const statsSpan = document.createElement('span');
      statsSpan.textContent = `${entry.wins}/${entry.losses}`;

      row.append(rankSpan, nameContainer, scoreSpan, statsSpan);
      entriesDiv.appendChild(row);
    });
  },
};
