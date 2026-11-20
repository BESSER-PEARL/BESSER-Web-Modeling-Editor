import crypto from 'crypto';
import { Express } from 'express';

const alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function randomString(length: number) {
  let result = '';
  for (let i = 0; i < length; i++) result += alphabet[crypto.randomInt(alphabet.length)];
  return result;
}

/** Start `app` on `port`: on `host` (`HOST`, e.g. 127.0.0.1 behind a proxy on the same machine), else on every interface. */
export function listen(app: Express, port: number, host: string | undefined, onListening: () => void) {
  return host ? app.listen(port, host, onListening) : app.listen(port, onListening);
}
