export const GameLogic = {
    calculateScore(timer, streak) {
        const streakBonus = Math.min((streak - 1) * 10, 100);
        const timeBonus = Math.min(Math.floor(timer * 2), 30);
        return 100 + streakBonus + timeBonus;
    },

    shuffle(array, seed) {
        let m = array.length, t, i;
        while (m) {
            i = Math.floor((seed ? (Math.abs(Math.sin(seed++)) * 10000) % 1 : Math.random()) * m--); // Sicherstellen, dass Math.sin einen positiven Wert liefert
            t = array[m]; array[m] = array[i]; array[i] = t;
        }
        return array;
    },

    async generateChallengeCode(seed, score, secret) {
        const payload = { seed, score, ts: Date.now() };
        const msg = JSON.stringify(payload);
        const key = await crypto.subtle.importKey(
            'raw', new TextEncoder().encode(secret || (()=>{throw new Error('SYSTEM_SECRET not provided for GameLogic');})()),
            { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
        );
        const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
        const sigHex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2,'0')).join('').slice(0, 16);
        return btoa(JSON.stringify({ ...payload, sig: sigHex }));
    }
};
