import crypto from 'node:crypto';

export type HashAlgorithm = 'md5' | 'sha1' | 'sha256' | 'sha512' | 'sha3-256' | 'sha3-512';
export type OutputFormat = 'hex' | 'base64';
export type InputEncoding = 'utf8' | 'hex' | 'base64';

export interface HashOptions {
  hmacKey?: string;
  outputFormat?: OutputFormat;
  inputEncoding?: InputEncoding;
}

export function computeHash(
  input: string,
  algorithm: HashAlgorithm,
  options?: HashOptions
): string {
  const outputFormat = options?.outputFormat ?? 'hex';
  const inputEncoding = options?.inputEncoding ?? 'utf8';

  const inputBuffer = Buffer.from(input, inputEncoding as BufferEncoding);

  if (options?.hmacKey) {
    const hmac = crypto.createHmac(algorithm, options.hmacKey);
    hmac.update(inputBuffer);
    return hmac.digest(outputFormat as crypto.BinaryToTextEncoding);
  }

  const hash = crypto.createHash(algorithm);
  hash.update(inputBuffer);
  return hash.digest(outputFormat as crypto.BinaryToTextEncoding);
}
