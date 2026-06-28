async getSignature(data, secret) {
    if (!secret) {
        secret = 'LOCAL_ONLY_UNTRUSTED';  // Expliziter Fallback wie vom Test erwartet
    }

    const key = await crypto.subtle.importKey(
        'raw', 
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' }, 
        false, 
        ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
    // ... restliche Methode (ArrayBuffer zu Hex etc.)
    return Array.from(new Uint8Array(sig))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}
