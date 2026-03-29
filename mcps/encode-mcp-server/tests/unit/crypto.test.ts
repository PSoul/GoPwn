import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import {
  aesEncrypt,
  aesDecrypt,
  randomString,
  jwtDecode,
  uuidGenerate,
} from '../../src/codec/crypto.js';

describe('crypto', () => {
  const testKey = crypto.randomBytes(32).toString('hex');
  const testIvCbc = crypto.randomBytes(16).toString('hex');
  const testIvGcm = crypto.randomBytes(12).toString('hex');

  describe('AES-CBC', () => {
    it('encrypts and decrypts round-trip', () => {
      const plaintext = 'Hello, World!';
      const encrypted = aesEncrypt(plaintext, testKey, testIvCbc, 'cbc');
      expect(encrypted.mode).toBe('cbc');
      expect(encrypted.ciphertext).toBeTruthy();
      expect(encrypted.authTag).toBeUndefined();

      const decrypted = aesDecrypt(encrypted.ciphertext, testKey, encrypted.iv, 'cbc');
      expect(decrypted.plaintext).toBe(plaintext);
    });

    it('generates IV when not provided', () => {
      const encrypted = aesEncrypt('test', testKey, undefined, 'cbc');
      expect(encrypted.iv).toHaveLength(32); // 16 bytes = 32 hex chars
      const decrypted = aesDecrypt(encrypted.ciphertext, testKey, encrypted.iv, 'cbc');
      expect(decrypted.plaintext).toBe('test');
    });
  });

  describe('AES-GCM', () => {
    it('encrypts and decrypts round-trip', () => {
      const plaintext = 'Sensitive data here';
      const encrypted = aesEncrypt(plaintext, testKey, testIvGcm, 'gcm');
      expect(encrypted.mode).toBe('gcm');
      expect(encrypted.authTag).toBeTruthy();

      const decrypted = aesDecrypt(
        encrypted.ciphertext,
        testKey,
        encrypted.iv,
        'gcm',
        encrypted.authTag
      );
      expect(decrypted.plaintext).toBe(plaintext);
    });

    it('generates IV when not provided', () => {
      const encrypted = aesEncrypt('test', testKey, undefined, 'gcm');
      expect(encrypted.iv).toHaveLength(24); // 12 bytes = 24 hex chars
      const decrypted = aesDecrypt(
        encrypted.ciphertext,
        testKey,
        encrypted.iv,
        'gcm',
        encrypted.authTag
      );
      expect(decrypted.plaintext).toBe('test');
    });
  });

  describe('random-string', () => {
    it('generates string of specified length', () => {
      const result = randomString(16);
      expect(result).toHaveLength(16);
    });

    it('defaults to 32 characters', () => {
      const result = randomString();
      expect(result).toHaveLength(32);
    });

    it('generates alphanumeric by default', () => {
      const result = randomString(100);
      expect(result).toMatch(/^[A-Za-z0-9]+$/);
    });

    it('generates hex charset', () => {
      const result = randomString(16, 'hex');
      expect(result).toMatch(/^[0-9a-f]+$/);
    });

    it('generates base64 charset', () => {
      const result = randomString(16, 'base64');
      expect(result).toHaveLength(16);
    });

    it('generates ascii charset', () => {
      const result = randomString(16, 'ascii');
      expect(result).toHaveLength(16);
    });
  });

  describe('jwt-decode', () => {
    it('decodes a JWT token', () => {
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({ sub: '1234567890', name: 'John Doe', iat: 1516239022 })
      ).toString('base64url');
      const signature = 'test-signature';
      const token = `${header}.${payload}.${signature}`;

      const result = jwtDecode(token);
      expect(result.header).toEqual({ alg: 'HS256', typ: 'JWT' });
      expect(result.payload).toEqual({
        sub: '1234567890',
        name: 'John Doe',
        iat: 1516239022,
      });
      expect(result.signature).toBe(signature);
    });

    it('throws on invalid JWT format', () => {
      expect(() => jwtDecode('invalid-token')).toThrow('Invalid JWT format');
    });
  });

  describe('uuid-generate', () => {
    it('generates a valid UUID v4', () => {
      const uuid = uuidGenerate();
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it('generates unique UUIDs', () => {
      const uuids = new Set(Array.from({ length: 10 }, () => uuidGenerate()));
      expect(uuids.size).toBe(10);
    });
  });
});
