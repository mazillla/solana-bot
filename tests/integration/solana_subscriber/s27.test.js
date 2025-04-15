import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleDisconnect } from '@/services/solana_subscriber/rpc/handleDisconnect.js';
import * as rpcPoolCore from '@/services/solana_subscriber/rpc/rpcPoolCore.js';
import * as subscriptionManager from '@/services/solana_subscriber/subscription/subscriptionManager.js';
import * as sharedLogger from '@/utils/sharedLogger.js';
import { getCurrentConfig } from '@/services/solana_subscriber/config/configLoader.js';

vi.mock('@/services/solana_subscriber/config/configLoader.js', () => ({
  getCurrentConfig: vi.fn(() => ({
    rpc_endpoints: [{ http: 'http://main-rpc', ws: 'ws://main-rpc' }],
  })),
}));

describe('S27: RPC падает и происходит переключение на резервный', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(rpcPoolCore, 'closeRpcPool').mockResolvedValue();
    vi.spyOn(rpcPoolCore, 'initRpcPool').mockResolvedValue();
    vi.spyOn(subscriptionManager, 'resubscribeAll').mockResolvedValue();
    vi.spyOn(sharedLogger, 'sharedLogger').mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('при отключении вызывает пересоздание пула и переподписку', async () => {
    await handleDisconnect('rpc-dead');

    expect(rpcPoolCore.closeRpcPool).toHaveBeenCalled();

    expect(rpcPoolCore.initRpcPool).toHaveBeenCalledWith(
      [{ http: 'http://main-rpc', ws: 'ws://main-rpc' }],
      expect.any(Function)
    );

    expect(subscriptionManager.resubscribeAll).toHaveBeenCalled();

    expect(sharedLogger.sharedLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'warn',
        message: expect.objectContaining({
          type: 'ws_disconnect',
          rpc_id: 'rpc-dead',
        }),
      })
    );

    expect(sharedLogger.sharedLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'info',
        message: expect.objectContaining({
          type: 'reconnect',
          rpc_id: 'rpc-dead',
        }),
      })
    );
  });
});
