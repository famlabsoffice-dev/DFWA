import { io } from 'socket.io-client';
import { UIManager } from './ui-manager.js';

export const BattleManager = {
  socket: null,
  currentBattleId: null,
  pingInterval: null,
  rtt: 0,

  init(baseUrl, playerId, playerName) {
    if (this.socket) return;

    this.socket = io(baseUrl);

    this.socket.on('connect', () => {
      console.log('Connected to Battle Server');
      const statusEl = document.getElementById('lobby-connection-status');
      if (statusEl) {
        statusEl.innerText = 'LINK_STATUS: ONLINE';
        statusEl.style.color = 'var(--neon)';
      }
      this.startPing();
    });

    this.socket.on('player_joined', ({ playerId: joinedPlayerId, activePlayers }) => {
      console.log(`Player joined: ${joinedPlayerId}`);
      const oppHud = document.getElementById('opponent-hud');
      if (oppHud) {
        oppHud.style.display = activePlayers.length > 1 ? 'block' : 'none';
      }
      const countEl = document.getElementById('lobby-player-count');
      if (countEl) {
        countEl.innerText = `ACTIVE_USERS: ${activePlayers.length}`;
      }
    });

    this.socket.on('opponent_action', ({ playerId: opponentId, action }) => {
      console.log(`Opponent ${opponentId} action:`, action);
      
      const oppHud = document.getElementById('opponent-hud');
      if (oppHud && action.type === 'error') {
        // Glitch-Effekt bei Fehlern des Gegners
        oppHud.classList.add('glitch-active');
        setTimeout(() => oppHud.classList.remove('glitch-active'), 500);
        
        // Visueller Indikator im HUD
        const oppScore = document.getElementById('opp-score');
        if (oppScore) {
          const originalColor = oppScore.style.color;
          oppScore.style.color = 'var(--error)';
          setTimeout(() => oppScore.style.color = originalColor, 500);
        }
      }
    });

    this.socket.on('opponent_sync', ({ playerId: opponentId, state: opponentState }) => {
      console.log(`Opponent ${opponentId} state:`, opponentState);
      
      const oppScore = document.getElementById('opp-score');
      if (oppScore) oppScore.innerText = `${opponentState.score}_PTS`;

      const oppStreak = document.getElementById('opp-streak');
      const oppStreakCount = document.getElementById('opp-streak-count');
      if (oppStreak && oppStreakCount) {
        if (opponentState.streak >= 3) {
          oppStreak.style.display = 'inline';
          oppStreakCount.innerText = opponentState.streak;
        } else {
          oppStreak.style.display = 'none';
        }
      }
    });

    this.socket.on('sabotage', ({ type, duration }) => {
      console.log(`SABOTAGE RECEIVED: ${type}`);
      if (type === 'timer_drain') {
        UIManager.showToast('SYSTEM BREACH: TIMER DRAINED!', 'error');
        // Event für app.js auslösen
        window.dispatchEvent(new CustomEvent('sabotage_timer', { detail: { duration } }));
      }
    });

    this.socket.on('player_left', ({ socketId, activePlayers }) => {
      console.log(`Opponent left: ${socketId}`);
      const oppHud = document.getElementById('opponent-hud');
      if (oppHud) oppHud.style.display = (activePlayers && activePlayers.length > 1) ? 'block' : 'none';
      
      const countEl = document.getElementById('lobby-player-count');
      if (countEl && activePlayers) {
        countEl.innerText = `ACTIVE_USERS: ${activePlayers.length}`;
      }
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from Battle Server');
      const statusEl = document.getElementById('lobby-connection-status');
      if (statusEl) {
        statusEl.innerText = 'LINK_STATUS: OFFLINE';
        statusEl.style.color = 'var(--error)';
      }
      this.stopPing();
    });

    this.socket.on('pong', () => {
      this.rtt = Date.now() - this.lastPingTime;
      this.updateLatencyUI();
    });
  },

  startPing() {
    this.stopPing();
    this.pingInterval = setInterval(() => {
      this.lastPingTime = Date.now();
      this.socket.emit('ping');
    }, 2000);
  },

  stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  },

  updateLatencyUI() {
    const latencyEl = document.getElementById('latency-display');
    if (latencyEl) {
      latencyEl.innerText = `RTT: ${this.rtt}MS`;
      if (this.rtt < 50) latencyEl.style.color = 'var(--neon)';
      else if (this.rtt < 150) latencyEl.style.color = 'var(--warning)';
      else latencyEl.style.color = 'var(--error)';
    }
  },

  joinBattle(battleId, playerId) {
    if (!this.socket) return;
    this.currentBattleId = battleId;
    this.socket.emit('join_battle', { battleId, playerId });
  },

  sendAction(action, playerId) {
    if (!this.socket || !this.currentBattleId) return;
    this.socket.emit('battle_action', { 
      battleId: this.currentBattleId, 
      playerId, 
      action 
    });
  },

  lastSync: 0,
  syncState(state, playerId) {
    if (!this.socket || !this.currentBattleId) return;
    
    // Throttling: Max 5 syncs per second (200ms interval) to reduce traffic
    const now = Date.now();
    if (now - this.lastSync < 200) return;
    this.lastSync = now;

    this.socket.emit('sync_state', { 
      battleId: this.currentBattleId, 
      playerId, 
      state 
    });
  }
};
