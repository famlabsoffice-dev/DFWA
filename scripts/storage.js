export const StorageManager = {
    async getSignature(data, secret) {
        const key = await crypto.subtle.importKey(
            'raw', new TextEncoder().encode(secret || (()=>{throw new Error('SYSTEM_SECRET not provided for StorageManager');})()),
            { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
        );
        const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
        return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2,'0')).join('');
    },

    async saveSecure(key, value, secret) {
        localStorage.setItem(key, value);
        const sig = await this.getSignature(value.toString(), secret);
        localStorage.setItem(`${key}_sig`, sig);
    },

    async validateIntegrity(keys, secret, onFail) {
        for (const key of keys) {
            const val = localStorage.getItem(key);
            const sig = localStorage.getItem(`${key}_sig`);
            if (val && sig) {
                const expected = await this.getSignature(val.toString(), secret);
                if (sig !== expected) {
                    console.warn(`INTEGRITY_FAILURE: ${key} tampered. Resetting.`);
                    localStorage.removeItem(key);
                    localStorage.removeItem(`${key}_sig`);
                    onFail(key);
                }
            }
        }
    }
};
