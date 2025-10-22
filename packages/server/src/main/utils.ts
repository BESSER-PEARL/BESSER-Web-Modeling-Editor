import crypto from 'crypto';

const alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function randomString(length: number) {
  let result = '';
  for (let i = 0; i < length; i++) result += alphabet[crypto.randomInt(alphabet.length)];
  return result;
}
