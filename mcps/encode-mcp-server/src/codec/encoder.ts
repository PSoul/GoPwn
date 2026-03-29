export type EncodingAlgorithm =
  | 'base64'
  | 'base64url'
  | 'url'
  | 'hex'
  | 'html'
  | 'unicode'
  | 'utf8';

export interface EncoderOptions {
  doubleEncode?: boolean;
  charset?: string;
}

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
};

const HTML_ENTITIES_REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(HTML_ENTITIES).map(([k, v]) => [v, k])
);

export function encode(
  input: string,
  algorithm: EncodingAlgorithm,
  options?: EncoderOptions
): string {
  switch (algorithm) {
    case 'base64':
      return Buffer.from(input).toString('base64');

    case 'base64url':
      return Buffer.from(input).toString('base64url');

    case 'url': {
      let result = encodeURIComponent(input);
      if (options?.doubleEncode) {
        result = encodeURIComponent(result);
      }
      return result;
    }

    case 'hex':
      return Buffer.from(input).toString('hex');

    case 'html':
      return input.replace(/[&<>"']/g, (ch) => HTML_ENTITIES[ch] ?? ch);

    case 'unicode':
      return Array.from(input)
        .map((ch) => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'))
        .join('');

    case 'utf8':
      return Buffer.from(input, 'utf8').toString('hex');

    default:
      throw new Error(`Unsupported encoding algorithm: ${algorithm}`);
  }
}

export function decode(
  input: string,
  algorithm: EncodingAlgorithm,
  options?: EncoderOptions
): string {
  switch (algorithm) {
    case 'base64':
      return Buffer.from(input, 'base64').toString();

    case 'base64url':
      return Buffer.from(input, 'base64url').toString();

    case 'url': {
      let result = input;
      if (options?.doubleEncode) {
        result = decodeURIComponent(result);
      }
      return decodeURIComponent(result);
    }

    case 'hex':
      return Buffer.from(input, 'hex').toString();

    case 'html':
      return input.replace(
        /&amp;|&lt;|&gt;|&quot;|&#x27;/g,
        (entity) => HTML_ENTITIES_REVERSE[entity] ?? entity
      );

    case 'unicode':
      return input.replace(/\\u([0-9a-fA-F]{4})/g, (_, code) =>
        String.fromCharCode(parseInt(code, 16))
      );

    case 'utf8':
      return Buffer.from(input, 'hex').toString('utf8');

    default:
      throw new Error(`Unsupported decoding algorithm: ${algorithm}`);
  }
}
