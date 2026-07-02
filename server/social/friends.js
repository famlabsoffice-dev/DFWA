/**
 * PHASE 5.2: FRIEND SYSTEM
 * Status: Implemented
 */

import crypto from 'crypto';

/**
 * Validates the auth signature for friend-related requests
 * @param {Object} data 
 * @param {string} auth 
 * @param {string} secret 
 * @returns {boolean}
 */
export function validateFriendAuth(data, auth, secret) {
  if (auth === secret) return true;
  const msg = JSON.stringify(data);
  const expectedAuth = crypto.createHmac('sha256', secret).update(msg).digest('hex');
  return auth === expectedAuth;
}

/**
 * Handles sending a friend request
 * @param {Object} db 
 * @param {string} senderId 
 * @param {string} receiverId 
 * @returns {Promise<Object>}
 */
export async function sendFriendRequest(db, senderId, receiverId) {
  return new Promise((resolve, reject) => {
    if (senderId === receiverId) {
      return reject(new Error('CANNOT_FRIEND_SELF'));
    }

    // Check if already friends
    const checkFriendsQuery = "SELECT * FROM friends WHERE (user_id1 = ? AND user_id2 = ?) OR (user_id1 = ? AND user_id2 = ?)";
    db.get(checkFriendsQuery, [senderId, receiverId, receiverId, senderId], (err, row) => {
      if (err) return reject(err);
      if (row) return reject(new Error('ALREADY_FRIENDS'));

      // Check for existing request
      const checkReqQuery = "SELECT * FROM friend_requests WHERE sender_id = ? AND receiver_id = ? AND status = 'PENDING'";
      db.get(checkReqQuery, [senderId, receiverId], (err, row) => {
        if (err) return reject(err);
        if (row) return reject(new Error('REQUEST_ALREADY_SENT'));

        // Insert new request
        const insertQuery = "INSERT INTO friend_requests (sender_id, receiver_id) VALUES (?, ?)";
        db.run(insertQuery, [senderId, receiverId], function(err) {
          if (err) return reject(err);
          resolve({ success: true, requestId: this.lastID });
        });
      });
    });
  });
}

/**
 * Handles accepting a friend request
 * @param {Object} db 
 * @param {string} requestId 
 * @param {string} receiverId 
 * @returns {Promise<Object>}
 */
export async function acceptFriendRequest(db, requestId, receiverId) {
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM friend_requests WHERE id = ? AND receiver_id = ? AND status = 'PENDING'", [requestId, receiverId], (err, row) => {
      if (err) return reject(err);
      if (!row) return reject(new Error('REQUEST_NOT_FOUND_OR_INVALID'));

      const senderId = row.sender_id;

      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        // Update request status
        db.run("UPDATE friend_requests SET status = 'ACCEPTED' WHERE id = ?", [requestId]);
        
        // Add to friends table (always store smaller ID as user_id1 for uniqueness)
        const sorted = [senderId, receiverId].sort();
        db.run("INSERT OR IGNORE INTO friends (user_id1, user_id2) VALUES (?, ?)", [sorted[0], sorted[1]]);

        db.run('COMMIT', (err) => {
          if (err) {
            db.run('ROLLBACK');
            return reject(err);
          }
          resolve({ success: true });
        });
      });
    });
  });
}

/**
 * Lists friends for a user
 * @param {Object} db 
 * @param {string} userId 
 * @returns {Promise<Array>}
 */
export async function listFriends(db, userId) {
  return new Promise((resolve, reject) => {
    const query = "SELECT CASE WHEN user_id1 = ? THEN user_id2 ELSE user_id1 END AS friendId, l.playerName, l.elo, l.league FROM friends f JOIN leaderboard l ON l.playerId = friendId WHERE user_id1 = ? OR user_id2 = ?";
    db.all(query, [userId, userId, userId], (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}
