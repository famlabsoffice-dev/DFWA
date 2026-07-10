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

  renderFriends(friendsDiv, friends) {
    if (!friendsDiv) return;
    friendsDiv.replaceChildren();

    if (friends.length === 0) {
      friendsDiv.innerHTML = '<div style="text-align:center; color:rgba(0,255,0,0.5); padding: 10px;">NO_ALLIES_CONNECTED</div>';
      return;
    }

    friends.forEach((friend) => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.alignItems = 'center';
      row.style.padding = '5px 0';
      row.style.borderBottom = '1px solid rgba(0,255,0,0.1)';

      row.innerHTML = `
        <div style="display:flex; flex-direction:column;">
          <span style="font-weight:900; color:var(--neon);">${friend.playerName}</span>
          <span style="font-size:0.5rem; color:var(--cyber-blue);">${friend.league} [${friend.elo}]</span>
        </div>
        <button class="option-btn challenge-friend-btn" data-id="${friend.playerId}" style="font-size: 0.5rem; padding: 2px 8px; width: auto; border-color: var(--warning); color: var(--warning);">BATTLE</button>
      `;
      friendsDiv.appendChild(row);
    });
  },

  renderSearchResults(container, results) {
    if (!container) return;
    container.innerHTML = '';
    if (results.length === 0) {
      container.innerHTML = '<div style="padding:10px; color:rgba(0,255,0,0.5);">NO_PLAYERS_FOUND</div>';
      return;
    }
    results.forEach(player => {
      const div = document.createElement('div');
      div.className = 'leaderboard-entry';
      div.style.padding = '10px';
      div.style.marginBottom = '5px';
      div.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
          <div>
            <div style="color:var(--neon); font-weight:bold;">${player.playerName}</div>
            <div style="font-size:0.7rem; color:var(--cyber-blue);">${player.league} [${player.elo}]</div>
          </div>
          <button class="option-btn add-friend-btn" data-id="${player.playerId}" style="width:auto; padding:5px 15px;">ADD</button>
        </div>
      `;
      container.appendChild(div);
    });
  },

  renderPendingRequests(container, requests) {
    if (!container) return;
    container.innerHTML = '';
    if (requests.length === 0) {
      container.style.display = 'none';
      return;
    }
    container.style.display = 'block';
    const title = document.createElement('div');
    title.style.color = 'var(--warning)';
    title.style.fontSize = '0.7rem';
    title.style.marginBottom = '10px';
    title.textContent = 'PENDING_INCOMING_LINK_REQUESTS:';
    container.appendChild(title);

    requests.forEach(req => {
      const div = document.createElement('div');
      div.className = 'leaderboard-entry';
      div.style.padding = '10px';
      div.style.marginBottom = '5px';
      div.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
          <div>
            <div style="color:var(--neon); font-weight:bold;">${req.playerName}</div>
            <div style="font-size:0.7rem; color:var(--cyber-blue);">${req.league} [${req.elo}]</div>
          </div>
          <button class="option-btn accept-friend-btn" data-request-id="${req.requestId}" style="width:auto; padding:5px 15px; border-color:var(--neon); color:var(--neon);">ACCEPT</button>
        </div>
      `;
      container.appendChild(div);
    });
  },

  renderLeaderboard(entriesDiv, data) {
    if (!entriesDiv) return;
    entriesDiv.replaceChildren();

    data.forEach((entry, index) => {
      const row = document.createElement('div');
      row.className = 'leaderboard-entry animate';
      row.style.animationDelay = `${index * 0.05}s`;

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
  },
};
