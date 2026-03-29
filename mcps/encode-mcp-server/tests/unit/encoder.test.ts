import { describe, it, expect } from 'vitest';
import { encode, decode } from '../../src/codec/encoder.js';

describe('encoder', () => {
  describe('base64', () => {
    it('encodes to base64', () => {
      expect(encode('Hello, World!', 'base64')).toBe('SGVsbG8sIFdvcmxkIQ==');
    });
    it('decodes from base64', () => {
      expect(decode('SGVsbG8sIFdvcmxkIQ==', 'base64')).toBe('Hello, World!');
    });
  });

  describe('base64url', () => {
    it('encodes to base64url', () => {
      const result = encode('Hello+World/Test=', 'base64url');
      expect(result).not.toContain('+');
      expect(result).not.toContain('/');
      expect(result).not.toContain('=');
    });
    it('decodes from base64url', () => {
      const encoded = encode('Hello+World/Test=', 'base64url');
      expect(decode(encoded, 'base64url')).toBe('Hello+World/Test=');
    });
  });

  describe('url', () => {
    it('encodes URL characters', () => {
      expect(encode('hello world&foo=bar', 'url')).toBe('hello%20world%26foo%3Dbar');
    });
    it('decodes URL characters', () => {
      expect(decode('hello%20world%26foo%3Dbar', 'url')).toBe('hello world&foo=bar');
    });
    it('supports double encoding', () => {
      const result = encode('hello world', 'url', { doubleEncode: true });
      expect(result).toBe('hello%2520world');
    });
    it('supports double decoding', () => {
      expect(decode('hello%2520world', 'url', { doubleEncode: true })).toBe('hello world');
    });
  });

  describe('hex', () => {
    it('encodes to hex', () => {
      expect(encode('ABC', 'hex')).toBe('414243');
    });
    it('decodes from hex', () => {
      expect(decode('414243', 'hex')).toBe('ABC');
    });
  });

  describe('html', () => {
    it('encodes HTML entities', () => {
      expect(encode('<script>alert("xss")</script>', 'html')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
      );
    });
    it('decodes HTML entities', () => {
      expect(decode('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;', 'html')).toBe(
        '<script>alert("xss")</script>'
      );
    });
    it('encodes ampersand and single quote', () => {
      expect(encode("A & B's", 'html')).toBe('A &amp; B&#x27;s');
    });
  });

  describe('unicode', () => {
    it('encodes to unicode escapes', () => {
      expect(encode('ABC', 'unicode')).toBe('\\u0041\\u0042\\u0043');
    });
    it('decodes unicode escapes', () => {
      expect(decode('\\u0041\\u0042\\u0043', 'unicode')).toBe('ABC');
    });
  });

  describe('utf8', () => {
    it('encodes utf8 to hex bytes', () => {
      expect(encode('ABC', 'utf8')).toBe('414243');
    });
    it('decodes hex bytes to utf8', () => {
      expect(decode('414243', 'utf8')).toBe('ABC');
    });
    it('handles multibyte characters', () => {
      const encoded = encode('cafe\u0301', 'utf8');
      expect(decode(encoded, 'utf8')).toBe('cafe\u0301');
    });
  });

  describe('round-trip', () => {
    const algorithms = ['base64', 'base64url', 'url', 'hex', 'html', 'unicode', 'utf8'] as const;
    const testInput = 'Hello <World> & "Test"';

    for (const algo of algorithms) {
      it(`round-trips with ${algo}`, () => {
        const encoded = encode(testInput, algo);
        const decoded = decode(encoded, algo);
        expect(decoded).toBe(testInput);
      });
    }
  });
});
