export function setupBattleSync(io, db) {
  const activeBattles = new Map();

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('join_battle', ({ battleId, playerId }) => {
      socket.join(battleId);
      console.log(`Player ${playerId} joined battle ${battleId}`);
      
      if (!activeBattles.has(battleId)) {
        activeBattles.set(battleId, { players: [] });
      }
      const battle = activeBattles.get(battleId);
      if (!battle.players.includes(playerId)) {
        battle.players.push(playerId);
      }

      io.to(battleId).emit('player_joined', { playerId, activePlayers: battle.players });
    });

    socket.on('battle_action', ({ battleId, playerId, action }) => {
      // Broadcast action to all other players in the battle
      socket.to(battleId).emit('opponent_action', { playerId, action });
    });

    socket.on('sync_state', ({ battleId, playerId, state }) => {
      socket.to(battleId).emit('opponent_sync', { playerId, state });
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);
      // In a real scenario, we would track which battle the user was in and notify others
    });
  });
}
