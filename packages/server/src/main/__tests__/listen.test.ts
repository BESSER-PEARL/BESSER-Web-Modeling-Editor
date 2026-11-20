import { AddressInfo } from 'net';
import express from 'express';
import { afterEach, describe, expect, it } from 'vitest';
import { listen } from '../utils';

let close = () => {};
afterEach(() => close());

const addressOf = (host: string | undefined) =>
  new Promise<AddressInfo>((resolve) => {
    const server = listen(express(), 0, host, () => resolve(server.address() as AddressInfo));
    close = () => server.close();
  });

describe('listen', () => {
  it('binds the HOST it is given, so a server behind a proxy on the same machine is reachable only there', async () => {
    expect((await addressOf('127.0.0.1')).address).toBe('127.0.0.1');
  });

  it('listens on every interface without a HOST, as before', async () => {
    expect(['::', '0.0.0.0']).toContain((await addressOf(undefined)).address);
  });
});
