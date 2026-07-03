import { io } from 'socket.io-client';
import { UIManager } from './ui-manager.js';

export const BattleManager = {
  socket: null,
  currentBattleId: null,

  init(baseUrl, playerId, playerName) {
    if (this.socket) return;

    this.socket = io(baseUrl);

    this.socket.on('connect', () => {
      console.log('Connected to Battle Server');
    });

    this.socket.on('player_joined', ({ playerId: joinedPlayerId, activePlayers }) => {
      console.log(`Player joined: ${joinedPlayerId}`);
      UIManager.showModal('BATTLE_SYNC', `PLAYER_${joinedPlayerId}_CONNECTED\nACTIVE_UNITS: ${activePlayers.length}`, 'var(--cyber-blue)');
    });

    this.socket.on('opponent_action', ({ playerId: opponentId, action }) => {
      console.log(`Opponent ${opponentId} action:`, action);
      // Hier können visuelle Feedbacks für Gegner-Aktionen implementiert werden
    });

    this.socket.on('opponent_sync', ({ playerId: opponentId, state }) => {
      console.log(`Opponent ${opponentId} state:`, state);
      // Synchronisation des Gegner-Punktestands etc.
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from Battle Server');
    });
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

  syncState(state, playerId) {
    if (!this.socket || !this.currentBattleId) return;
    this.socket.emit('sync_state', { 
      battleId: this.currentBattleId, 
      playerId, 
      state 
    });
  }
};
