
import { StorageManager } from './storage.js';

// Mock the Web Crypto API for Jest
const mockSubtle = {
    async importKey(format, keyData, algorithm, extractable, keyUsages) {
        return { 
            name: algorithm.name, 
            hash: (algorithm.hash && algorithm.hash.name) ? algorithm.hash : { name: 'SHA-256' }, 
            usages: keyUsages 
        };
    },
    async sign(algorithm, key, data) {
        const dataString = new TextDecoder().decode(data);
        const hashName = (key.hash && key.hash.name) ? key.hash.name : 'SHA-256';
        const mockSignature = `mock_signature_for_${dataString}_${key.name}_${hashName}`;
        return new TextEncoder().encode(mockSignature).buffer;
    }
};

const mockCrypto = {
    subtle: mockSubtle,
    getRandomValues: jest.fn(arr => {
        for (let i = 0; i < arr.length; i++) {
            arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
    })
};

Object.defineProperty(global, 'crypto', {
    value: mockCrypto,
    writable: true
});

// Mock localStorage
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: jest.fn(key => store[key] || null),
        setItem: jest.fn((key, value) => { store[key] = value.toString(); }),
        removeItem: jest.fn(key => { delete store[key]; }),
        clear: jest.fn(() => { store = {}; })
    };
})();

Object.defineProperty(global, 'localStorage', {
    value: localStorageMock,
    writable: true
});

describe('StorageManager', () => {
    const TEST_SECRET = 'test_secret';

    beforeEach(() => {
        localStorage.clear();
        jest.clearAllMocks();
    });

    describe('getSignature', () => {
        test('should generate a consistent signature for given data and secret', async () => {
            const data = 'test_data';
            const signature = await StorageManager.getSignature(data, TEST_SECRET);
            expect(signature).toBeDefined();
            expect(typeof signature).toBe('string');
            // Expect the mock signature to be returned and converted to hex string
            const expectedMockSignature = Array.from(new TextEncoder().encode(`mock_signature_for_test_data_HMAC_SHA-256`))
                                            .map(b => b.toString(16).padStart(2, '0')).join('');
            expect(signature).toBe(expectedMockSignature);
        });

        test('should generate a different signature for different data', async () => {
            const data1 = 'test_data_1';
            const data2 = 'test_data_2';
            const signature1 = await StorageManager.getSignature(data1, TEST_SECRET);
            const signature2 = await StorageManager.getSignature(data2, TEST_SECRET);
            expect(signature1).not.toBe(signature2);
        });

        test('should throw error if no secret is provided', async () => {
            const data = 'test_data';
            await expect(StorageManager.getSignature(data)).rejects.toThrow('SYSTEM_SECRET not provided for StorageManager');
        });
    });

    describe('saveSecure', () => {
        test('should save value and its signature to localStorage', async () => {
            const key = 'my_key';
            const value = 'my_value';
            await StorageManager.saveSecure(key, value, TEST_SECRET);

            expect(localStorage.setItem).toHaveBeenCalledWith(key, value);
            expect(localStorage.setItem).toHaveBeenCalledWith(`${key}_sig`, expect.any(String));
            expect(localStorage.getItem(key)).toBe(value);
            expect(localStorage.getItem(`${key}_sig`)).toBeDefined();
        });

        test('should correctly save a number value', async () => {
            const key = 'numeric_key';
            const value = 12345;
            await StorageManager.saveSecure(key, value, TEST_SECRET);

            expect(localStorage.setItem).toHaveBeenCalledWith(key, value);
            expect(localStorage.setItem).toHaveBeenCalledWith(`${key}_sig`, expect.any(String));
            expect(localStorage.getItem(key)).toBe(value.toString());
        });
    });

    describe('validateIntegrity', () => {
        test('should do nothing if keys are not found in localStorage', async () => {
            const onFail = jest.fn();
            await StorageManager.validateIntegrity(['non_existent_key'], TEST_SECRET, onFail);
            expect(onFail).not.toHaveBeenCalled();
            expect(localStorage.getItem).toHaveBeenCalledWith('non_existent_key');
            expect(localStorage.getItem).toHaveBeenCalledWith('non_existent_key_sig');
        });

        test('should call onFail and remove items if integrity check fails', async () => {
            const key = 'tampered_key';
            const originalValue = 'original_value';
            const tamperedValue = 'tampered_value';
            const onFail = jest.fn();

            // Simulate saving original value and then tampering it
            await StorageManager.saveSecure(key, originalValue, TEST_SECRET);
            localStorage.setItem(key, tamperedValue); // Tamper the value

            await StorageManager.validateIntegrity([key], TEST_SECRET, onFail);

            expect(onFail).toHaveBeenCalledWith(key);
            expect(localStorage.removeItem).toHaveBeenCalledWith(key);
            expect(localStorage.removeItem).toHaveBeenCalledWith(`${key}_sig`);
            expect(localStorage.getItem(key)).toBeNull();
            expect(localStorage.getItem(`${key}_sig`)).toBeNull();
        });

        test('should not call onFail if integrity check passes', async () => {
            const key = 'valid_key';
            const value = 'valid_value';
            const onFail = jest.fn();

            await StorageManager.saveSecure(key, value, TEST_SECRET);
            await StorageManager.validateIntegrity([key], TEST_SECRET, onFail);

            expect(onFail).not.toHaveBeenCalled();
            expect(localStorage.getItem(key)).toBe(value);
        });

        test('should handle multiple keys correctly', async () => {
            const key1 = 'valid_key_1';
            const value1 = 'valid_value_1';
            const key2 = 'tampered_key_2';
            const originalValue2 = 'original_value_2';
            const tamperedValue2 = 'tampered_value_2';
            const onFail = jest.fn();

            await StorageManager.saveSecure(key1, value1, TEST_SECRET);
            await StorageManager.saveSecure(key2, originalValue2, TEST_SECRET);
            localStorage.setItem(key2, tamperedValue2); // Tamper key2

            await StorageManager.validateIntegrity([key1, key2], TEST_SECRET, onFail);

            expect(onFail).toHaveBeenCalledTimes(1);
            expect(onFail).toHaveBeenCalledWith(key2);
            expect(localStorage.getItem(key1)).toBe(value1);
            expect(localStorage.getItem(key2)).toBeNull();
        });

        test('should not fail if signature is missing but value exists', async () => {
            const key = 'missing_sig_key';
            const value = 'some_value';
            const onFail = jest.fn();

            localStorage.setItem(key, value);
            // No signature saved

            await StorageManager.validateIntegrity([key], TEST_SECRET, onFail);

            expect(onFail).not.toHaveBeenCalled();
            expect(localStorage.getItem(key)).toBe(value);
        });

        test('should not fail if value is missing but signature exists', async () => {
            const key = 'missing_value_key';
            const signature = 'some_signature';
            const onFail = jest.fn();

            localStorage.setItem(`${key}_sig`, signature);
            // No value saved

            await StorageManager.validateIntegrity([key], TEST_SECRET, onFail);

            expect(onFail).not.toHaveBeenCalled();
            expect(localStorage.getItem(`${key}_sig`)).toBe(signature);
        });
    });
});
