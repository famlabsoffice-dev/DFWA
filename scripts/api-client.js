export const APIClient = {
    async fetchSecret(baseUrl) {
        try {
            const res = await fetch(`${baseUrl}/config/secret`);
            if (res.ok) {
                const data = await res.json();
                return data.secret;
            }
        } catch (e) {}
        return 'LOCAL_ONLY_UNTRUSTED';
    },

    async updateLeaderboard(baseUrl, payload) {
        try {
            await fetch(`${baseUrl}/api/leaderboard`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (e) {
            console.warn('Leaderboard update failed (offline mode)');
        }
    },

    async fetchLeaderboard(baseUrl, limit = 20) {
        try {
            const res = await fetch(`${baseUrl}/api/leaderboard?limit=${limit}`);
            if (res.ok) return await res.json();
        } catch (e) {}
        throw new Error('SERVER_UNAVAILABLE');
    },

    async verifyChallenge(baseUrl, code) {
        const res = await fetch(`${baseUrl}/api/challenge/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        });
        const data = await res.json();
        if (!res.ok || !data.valid) throw new Error(data.error || 'INVALID_CODE');
        return data.data;
    },

    async reportError(baseUrl, errorData) {
        try {
            await fetch(`${baseUrl}/api/errors/client`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(errorData)
            });
        } catch (e) {}
    }
};
