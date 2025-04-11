import { Connection } from '@solana/web3.js';

export function connectionFactory(httpUrl, wsUrl = null) {
  return new Connection(httpUrl, {
    commitment: 'confirmed',
    ...(wsUrl ? { wsEndpoint: wsUrl } : {}),
  });
}
