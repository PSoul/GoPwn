import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { computeHash } from '../../src/codec/hasher.js';

describe('hasher', () => {
  const testInput = 'Hello, World!';

  describe('algorithms', () => {
    it('computes md5', () => {
      const expected = crypto.createHash('md5').update(testInput).digest('hex');
      expect(computeHash(testInput, 'md5')).toBe(expected);
    });

    it('computes sha1', () => {
      const expected = crypto.createHash('sha1').update(testInput).digest('hex');
      expect(computeHash(testInput, 'sha1')).toBe(expected);
    });

    it('computes sha256', () => {
      const expected = crypto.createHash('sha256').update(testInput).digest('hex');
      expect(computeHash(testInput, 'sha256')).toBe(expected);
    });

    it('computes sha512', () => {
      const expected = crypto.createHash('sha512').update(testInput).digest('hex');
      expect(computeHash(testInput, 'sha512')).toBe(expected);
    });

    it('computes sha3-256', () => {
      const expected = crypto.createHash('sha3-256').update(testInput).digest('hex');
      expect(computeHash(testInput, 'sha3-256')).toBe(expected);
    });

    it('computes sha3-512', () => {
      const expected = crypto.createHash('sha3-512').update(testInput).digest('hex');
      expect(computeHash(testInput, 'sha3-512')).toBe(expected);
    });
  });

  describe('HMAC', () => {
    it('computes HMAC-SHA256', () => {
      const key = 'secret-key';
      const expected = crypto.createHmac('sha256', key).update(testInput).digest('hex');
      expect(computeHash(testInput, 'sha256', { hmacKey: key })).toBe(expected);
    });

    it('computes HMAC-MD5', () => {
      const key = 'test-key';
      const expected = crypto.createHmac('md5', key).update(testInput).digest('hex');
      expect(computeHash(testInput, 'md5', { hmacKey: key })).toBe(expected);
    });
  });

  describe('output formats', () => {
    it('outputs hex by default', () => {
      const result = computeHash(testInput, 'sha256');
      expect(result).toMatch(/^[0-9a-f]+$/);
    });

    it('outputs base64', () => {
      const expected = crypto.createHash('sha256').update(testInput).digest('base64');
      expect(computeHash(testInput, 'sha256', { outputFormat: 'base64' })).toBe(expected);
    });
  });

  describe('input encodings', () => {
    it('handles hex input', () => {
      const hexInput = Buffer.from(testInput).toString('hex');
      const expected = crypto.createHash('sha256').update(Buffer.from(hexInput, 'hex')).digest('hex');
      expect(computeHash(hexInput, 'sha256', { inputEncoding: 'hex' })).toBe(expected);
    });

    it('handles base64 input', () => {
      const b64Input = Buffer.from(testInput).toString('base64');
      const expected = crypto
        .createHash('sha256')
        .update(Buffer.from(b64Input, 'base64'))
        .digest('hex');
      expect(computeHash(b64Input, 'sha256', { inputEncoding: 'base64' })).toBe(expected);
    });
  });
});
