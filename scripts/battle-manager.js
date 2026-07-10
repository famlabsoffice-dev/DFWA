import { io } from 'socket.io-client';
import { UIManager } from './ui-manager.js';

export const BattleManager = {
  socket: null,
  currentBattleId: null,
  pingInterval: null,
  rtt: 0,
  playerId: null,
  playerName: null,
  reconnectAttempts: 0,
  maxReconnectAttempts: 5,

  init(baseUrl, playerId, playerName) {
    if (this.socket) return;

    this.playerId = playerId;
    this.playerName = playerName;
    
    // Enhanced Socket.io configuration for hardening
    this.socket = io(baseUrl, {
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      transports: ['websocket', 'polling'] // Prefer websocket
    });

    this.socket.on('connect', () => {
      console.log('LINK_ESTABLISHED: SECURE_CHANNEL_OPEN');
      this.reconnectAttempts = 0;
      this.updateConnectionStatus(true);
      this.startPing();
      
      // Auto-rejoin if we were in a battle
      if (this.currentBattleId) {
        this.joinBattle(this.currentBattleId);
      }
    });

    this.socket.on('player_joined', ({ playerId: joinedPlayerId, playerName: joinedName, activePlayers }) => {
      console.log(`ENTITY_JOINED: ${joinedName} (${joinedPlayerId})`);
      if (joinedPlayerId !== this.playerId) {
        UIManager.showToast(`NEW_ENTITY: ${joinedName}`, 'info');
      }
      this.updateLobbyUI(activePlayers);
    });

    this.socket.on('opponent_action', ({ playerId: opponentId, action }) => {
      this.handleOpponentAction(action);
    });

    this.socket.on('opponent_sync', ({ playerId: opponentId, state: opponentState }) => {
      this.updateOpponentHUD(opponentState);
    });

    this.socket.on('sabotage', ({ type, duration, attackerId }) => {
      this.handleSabotage(type, duration);
    });

    this.socket.on('player_disconnected', ({ playerId: discId }) => {
      console.warn(`ENTITY_LINK_LOST: ${discId}`);
      if (discId !== this.playerId) {
        UIManager.showToast('OPPONENT_LINK_LOST: WAITING...', 'warning');
      }
    });

    this.socket.on('player_left', ({ playerId: leftId, activePlayers }) => {
      console.log(`ENTITY_TERMINATED: ${leftId}`);
      this.updateLobbyUI(activePlayers);
    });

    this.socket.on('disconnect', (reason) => {
      console.error('LINK_TERMINATED:', reason);
      this.updateConnectionStatus(false);
      this.stopPing();
      
      if (reason === 'io server disconnect') {
        // Server kicked us, try to reconnect manually
        this.socket.connect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('LINK_ERROR:', error.message);
      this.updateConnectionStatus(false);
      this.reconnectAttempts++;
      UIManager.showToast(`LINK_ERROR: RETRY_${this.reconnectAttempts}`, 'error');
    });

    this.socket.on('reconnect_attempt', (attempt) => {
      console.log(`LINK_RECOVERY: ATTEMPT_${attempt}`);
      UIManager.showToast(`LINK_RECOVERY: ATTEMPT_${attempt}`, 'warning');
    });

    this.socket.on('reconnect', () => {
      UIManager.showToast('LINK_RESTORED', 'success');
    });

    this.socket.on('pong_rtt', (clientTs) => {
      this.rtt = Date.now() - clientTs;
      this.updateLatencyUI();
    });
  },

  updateConnectionStatus(online) {
    const statusEl = document.getElementById('lobby-connection-status');
    if (statusEl) {
      statusEl.innerText = online ? 'LINK_STATUS: ONLINE' : 'LINK_STATUS: OFFLINE';
      statusEl.style.color = online ? 'var(--neon)' : 'var(--error)';
    }
  },

  updateLobbyUI(activePlayers = []) {
    const countEl = document.getElementById('lobby-player-count');
    if (countEl) {
      countEl.innerText = `ACTIVE_ENTITIES: ${activePlayers.length}`;
    }
    
    const oppHud = document.getElementById('opponent-hud');
    if (oppHud) {
      oppHud.style.display = activePlayers.length > 1 ? 'block' : 'none';
    }
  },

  handleOpponentAction(action) {
    const oppHud = document.getElementById('opponent-hud');
    if (oppHud && action.type === 'error') {
      oppHud.classList.add('glitch-active');
      setTimeout(() => oppHud.classList.remove('glitch-active'), 500);
      
      const oppScore = document.getElementById('opp-score');
      if (oppScore) {
        const originalColor = oppScore.style.color;
        oppScore.style.color = 'var(--error)';
        setTimeout(() => oppScore.style.color = originalColor, 500);
      }
    }
  },

  updateOpponentHUD(opponentState) {
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
  },

  handleSabotage(type, duration) {
    if (type === 'timer_drain') {
      UIManager.showToast('SYSTEM_BREACH: TIMER_DRAINED!', 'error');
      window.dispatchEvent(new CustomEvent('sabotage_timer', { detail: { duration } }));
    }
    
    const sabotageLayer = document.getElementById('sabotage-overlay');
    if (sabotageLayer) {
      sabotageLayer.classList.add('sabotage-active');
      setTimeout(() => sabotageLayer.classList.remove('sabotage-active'), 1000);
    }
  },

  startPing() {
    this.stopPing();
    this.pingInterval = setInterval(() => {
      if (this.socket && this.socket.connected) {
        this.socket.emit('ping_rtt', Date.now());
      }
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
      if (this.rtt < 80) latencyEl.style.color = 'var(--neon)';
      else if (this.rtt < 200) latencyEl.style.color = 'var(--warning)';
      else latencyEl.style.color = 'var(--error)';
    }
  },

  joinBattle(battleId) {
    if (!this.socket || !this.playerId) {
      UIManager.showToast('SYSTEM_ERROR: LINK_INACTIVE', 'error');
      return;
    }
    
    this.currentBattleId = battleId;
    this.socket.emit('join_battle', { 
      battleId, 
      playerId: this.playerId,
      playerName: this.playerName 
    });
  },

  sendAction(action) {
    if (!this.socket || !this.socket.connected || !this.currentBattleId) return;
    this.socket.emit('battle_action', { 
      battleId: this.currentBattleId, 
      playerId: this.playerId, 
      action 
    });
  },

  lastSync: 0,
  syncState(state) {
    if (!this.socket || !this.socket.connected || !this.currentBattleId) return;
    
    const now = Date.now();
    if (now - this.lastSync < 250) return; // Throttled to 4/s
    this.lastSync = now;

    this.socket.emit('sync_state', { 
      battleId: this.currentBattleId, 
      playerId: this.playerId, 
      state 
    });
  }
};
