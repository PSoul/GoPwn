export interface TcpConnectOptions {
  host: string;
  port: number;
  data?: string;
  encoding?: 'utf8' | 'hex' | 'base64';
  timeout?: number;
  readUntilClose?: boolean;
}

export interface TcpResponse {
  connected: boolean;
  response: { utf8: string; hex: string };
  timing: { connect: number; firstByte: number; total: number };
}

export interface UdpSendOptions {
  host: string;
  port: number;
  data: string;
  encoding?: 'utf8' | 'hex' | 'base64';
  timeout?: number;
}

export interface UdpResponse {
  response: { utf8: string; hex: string } | null;
  timing: { total: number };
}

export interface BannerGrabOptions {
  host: string;
  port: number;
  timeout?: number;
}

export interface BannerGrabResponse {
  banner: string;
  hex: string;
  timing: { connect: number; firstByte: number };
  probeSent?: string;
}
