export function setupBattleSync(io, db) {
  const activeBattles = new Map();

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('join_battle', ({ battleId, playerId, playerName }) => {
      socket.join(battleId);
      console.log(`Player ${playerId} (${playerName}) joined battle ${battleId}`);
      
      if (!activeBattles.has(battleId)) {
        activeBattles.set(battleId, { 
          players: [],
          playerDetails: new Map(),
          startTime: Date.now()
        });
      }
      
      const battle = activeBattles.get(battleId);
      if (!battle.players.includes(playerId)) {
        battle.players.push(playerId);
        battle.playerDetails.set(playerId, {
          socketId: socket.id,
          playerName,
          joinedAt: Date.now()
        });
      } else {
        // Update socket ID on reconnect
        battle.playerDetails.get(playerId).socketId = socket.id;
      }

      // Track battleId on socket for easier cleanup
      socket.currentBattleId = battleId;
      socket.playerId = playerId;

      io.to(battleId).emit('player_joined', { 
        playerId, 
        playerName,
        activePlayers: battle.players,
        playerDetails: Array.from(battle.playerDetails.entries())
      });
    });

    socket.on('battle_action', ({ battleId, playerId, action }) => {
      const battle = activeBattles.get(battleId);
      if (!battle) return;

      // Special handling for sabotage
      if (action.type === 'sabotage') {
        socket.to(battleId).emit('sabotage', { 
          type: action.sabotageType, 
          duration: action.duration,
          attackerId: playerId 
        });
        return;
      }
      
      // Broadcast action to all other players in the battle
      socket.to(battleId).emit('opponent_action', { playerId, action });
    });

    socket.on('sync_state', ({ battleId, playerId, state }) => {
      const battle = activeBattles.get(battleId);
      if (!battle) return;
      
      // Cache state in battle object for potential late-joiners or reconnections
      if (battle.playerDetails.has(playerId)) {
        battle.playerDetails.get(playerId).lastState = state;
      }

      socket.to(battleId).emit('opponent_sync', { playerId, state });
    });

    socket.on('ping_rtt', (clientTs) => {
      socket.emit('pong_rtt', clientTs);
    });

    socket.on('disconnecting', () => {
      const rooms = Array.from(socket.rooms);
      rooms.forEach(battleId => {
        if (activeBattles.has(battleId)) {
          const battle = activeBattles.get(battleId);
          const playerId = socket.playerId;
          
          if (playerId) {
            // We don't remove immediately to allow for short reconnects
            // But we notify others
            socket.to(battleId).emit('player_disconnected', { playerId, socketId: socket.id });
            
            // Cleanup after timeout if not reconnected
            setTimeout(() => {
              const currentBattle = activeBattles.get(battleId);
              if (currentBattle && currentBattle.playerDetails.has(playerId)) {
                const details = currentBattle.playerDetails.get(playerId);
                if (details.socketId === socket.id) {
                  currentBattle.players = currentBattle.players.filter(id => id !== playerId);
                  currentBattle.playerDetails.delete(playerId);
                  
                  io.to(battleId).emit('player_left', { 
                    playerId, 
                    activePlayers: currentBattle.players 
                  });

                  if (currentBattle.players.length === 0) {
                    activeBattles.delete(battleId);
                    console.log(`Battle ${battleId} terminated (empty)`);
                  }
                }
              }
            }, 5000); // 5s Grace period for reconnect
          }
        }
      });
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);
    });
  });
}
