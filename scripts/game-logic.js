export const GameLogic = {
  _crypto: typeof window !== 'undefined' ? window.crypto : null,
  calculateScore(timer, streak) {
    const streakBonus = Math.min((streak - 1) * 10, 100);
    const timeBonus = Math.min(Math.floor(timer * 2), 30);
    return 100 + streakBonus + timeBonus;
  },

  shuffle(array, seed) {
    let m = array.length,
      t,
      i;
    while (m) {
      i = Math.floor((seed ? (Math.abs(Math.sin(seed++)) * 10000) % 1 : Math.random()) * m--); // Sicherstellen, dass Math.sin einen positiven Wert liefert
      t = array[m];
      array[m] = array[i];
      array[i] = t;
    }
    return array;
  },

  async generateAuthPayload(playerId, score, wins, losses, mode, secret) {
    const ts = Date.now();
    const payload = { 
      playerId, 
      score: Number(score), 
      wins: Number(wins), 
      losses: Number(losses), 
      mode: mode || 'classic', 
      ts 
    };
    const msg = JSON.stringify(payload);
    const cryptoObj = this._crypto || globalThis.crypto;
    const key = await cryptoObj.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sig = await cryptoObj.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
    const sigHex = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return { ...payload, auth: sigHex };
  },

  async generateChallengeCode(seed, score, secret) {
    if (!secret) {
      throw new Error('SYSTEM_SECRET not provided for GameLogic');
    }
    const payload = { seed, score, ts: Date.now() };
    const msg = JSON.stringify(payload);
    const cryptoObj = this._crypto || globalThis.crypto;
    const key = await cryptoObj.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sig = await cryptoObj.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
    const sigHex = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    
    // Kombiniere Payload und Signatur in einen Base64 String für den Challenge Code
    const fullPayload = { ...payload, auth: sigHex };
    return btoa(JSON.stringify(fullPayload));
  },
};
