import { io } from 'socket.io-client';
import { UIManager } from './ui-manager.js';
import { GameLogic } from './game-logic.js';

export const BattleManager = {
  socket: null,
  currentBattleId: null,
  pingInterval: null,
  rtt: 0,
  playerId: null,
  playerName: null,

  init(baseUrl, playerId, playerName) {
    if (this.socket) return;

    this.playerId = playerId;
    this.playerName = playerName;
    this.socket = io(baseUrl);

    this.socket.on('connect', () => {
      console.log('Connected to Battle Server');
      this.updateConnectionStatus(true);
      this.startPing();
    });

    this.socket.on('player_joined', ({ playerId: joinedPlayerId, activePlayers }) => {
      console.log(`Player joined: ${joinedPlayerId}`);
      this.updateLobbyUI(activePlayers);
    });

    this.socket.on('opponent_action', ({ playerId: opponentId, action }) => {
      console.log(`Opponent ${opponentId} action:`, action);
      this.handleOpponentAction(action);
    });

    this.socket.on('opponent_sync', ({ playerId: opponentId, state: opponentState }) => {
      console.log(`Opponent ${opponentId} state:`, opponentState);
      this.updateOpponentHUD(opponentState);
    });

    this.socket.on('sabotage', ({ type, duration, attackerId }) => {
      console.log(`SABOTAGE RECEIVED: ${type} from ${attackerId}`);
      this.handleSabotage(type, duration);
    });

    this.socket.on('player_left', ({ socketId, activePlayers }) => {
      console.log(`Opponent left: ${socketId}`);
      this.updateLobbyUI(activePlayers);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected from Battle Server:', reason);
      this.updateConnectionStatus(false);
      this.stopPing();
      
      if (reason === 'io server disconnect') {
        this.socket.connect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection Error:', error);
      this.updateConnectionStatus(false);
      UIManager.showToast('LINK_ERROR: RETRYING...', 'error');
    });

    this.socket.on('reconnect_attempt', (attempt) => {
      console.log(`Reconnection attempt #${attempt}`);
      UIManager.showToast(`LINK_RECOVERY: ATTEMPT_${attempt}`, 'warning');
    });

    this.socket.on('reconnect', () => {
      UIManager.showToast('LINK_RESTORED', 'success');
      if (this.currentBattleId) {
        this.joinBattle(this.currentBattleId);
      }
    });

    this.socket.on('pong', () => {
      this.rtt = Date.now() - this.lastPingTime;
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
      countEl.innerText = `ACTIVE_USERS: ${activePlayers.length}`;
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
      UIManager.showToast('SYSTEM BREACH: TIMER DRAINED!', 'error');
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

  generateChallengeCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  },

  joinBattle(battleId) {
    if (!this.socket || !this.playerId) {
      UIManager.showToast('SYSTEM_ERROR: LINK_INACTIVE', 'error');
      return;
    }
    
    this.currentBattleId = battleId;
    UIManager.showToast(`JOINING_BATTLE: ${battleId}`, 'info');
    
    this.socket.emit('join_battle', { 
      battleId, 
      playerId: this.playerId,
      playerName: this.playerName 
    });
  },

  createChallenge() {
    const code = this.generateChallengeCode();
    this.joinBattle(code);
    return code;
  },

  sendAction(action) {
    if (!this.socket || !this.currentBattleId || !this.playerId) return;
    this.socket.emit('battle_action', { 
      battleId: this.currentBattleId, 
      playerId: this.playerId, 
      action 
    });
  },

  lastSync: 0,
  syncState(state) {
    if (!this.socket || !this.currentBattleId || !this.playerId) return;
    
    const now = Date.now();
    if (now - this.lastSync < 200) return;
    this.lastSync = now;

    this.socket.emit('sync_state', { 
      battleId: this.currentBattleId, 
      playerId: this.playerId, 
      state 
    });
  }
};
