import crypto from 'node:crypto';

export type AesMode = 'cbc' | 'gcm';
export type RandomCharset = 'alphanumeric' | 'hex' | 'base64' | 'ascii';

export interface AesEncryptResult {
  ciphertext: string;
  iv: string;
  authTag?: string;
  mode: AesMode;
}

export interface AesDecryptResult {
  plaintext: string;
  mode: AesMode;
}

export function aesEncrypt(
  data: string,
  key: string,
  iv?: string,
  mode: AesMode = 'cbc'
): AesEncryptResult {
  const keyBuffer = Buffer.from(key, 'hex');
  const ivBuffer = iv ? Buffer.from(iv, 'hex') : crypto.randomBytes(mode === 'cbc' ? 16 : 12);
  const algo = mode === 'cbc' ? 'aes-256-cbc' : 'aes-256-gcm';

  const cipher = crypto.createCipheriv(algo, keyBuffer, ivBuffer);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const result: AesEncryptResult = {
    ciphertext: encrypted,
    iv: ivBuffer.toString('hex'),
    mode,
  };

  if (mode === 'gcm') {
    result.authTag = (cipher as crypto.CipherGCM).getAuthTag().toString('hex');
  }

  return result;
}

export function aesDecrypt(
  ciphertext: string,
  key: string,
  iv: string,
  mode: AesMode = 'cbc',
  authTag?: string
): AesDecryptResult {
  const keyBuffer = Buffer.from(key, 'hex');
  const ivBuffer = Buffer.from(iv, 'hex');
  const algo = mode === 'cbc' ? 'aes-256-cbc' : 'aes-256-gcm';

  const decipher = crypto.createDecipheriv(algo, keyBuffer, ivBuffer);

  if (mode === 'gcm' && authTag) {
    (decipher as crypto.DecipherGCM).setAuthTag(Buffer.from(authTag, 'hex'));
  }

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return { plaintext: decrypted, mode };
}

export function randomString(
  length: number = 32,
  charset: RandomCharset = 'alphanumeric'
): string {
  const bytes = crypto.randomBytes(length);

  switch (charset) {
    case 'hex':
      return bytes.toString('hex').slice(0, length);
    case 'base64':
      return bytes.toString('base64').slice(0, length);
    case 'ascii': {
      const asciiChars = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join('');
      return Array.from(bytes)
        .map((b) => asciiChars[b % asciiChars.length])
        .slice(0, length)
        .join('');
    }
    case 'alphanumeric':
    default: {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      return Array.from(bytes)
        .map((b) => chars[b % chars.length])
        .slice(0, length)
        .join('');
    }
  }
}

export interface JwtDecodeResult {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: string;
}

export function jwtDecode(token: string): JwtDecodeResult {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format: expected 3 parts separated by dots');
  }

  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());

  return { header, payload, signature: parts[2] };
}

export function uuidGenerate(): string {
  return crypto.randomUUID();
}
