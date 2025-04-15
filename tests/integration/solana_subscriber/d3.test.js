import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleDisconnect } from '@/services/solana_subscriber/rpc/handleDisconnect.js';
import * as rpcPoolCore from '@/services/solana_subscriber/rpc/rpcPoolCore.js';
import * as configLoader from '@/services/solana_subscriber/config/configLoader.js';
import * as subscriptionManager from '@/services/solana_subscriber/subscription/subscriptionManager.js';
import * as sharedLogger from '@/utils/sharedLogger.js';

describe('D3: RPC недоступен долго → происходит восстановление', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(rpcPoolCore, 'closeRpcPool').mockResolvedValue();
    vi.spyOn(subscriptionManager, 'resubscribeAll').mockResolvedValue();
    vi.spyOn(sharedLogger, 'sharedLogger').mockResolvedValue();

    vi.spyOn(configLoader, 'getCurrentConfig').mockReturnValue({
      rpc_endpoints: [
        { http: 'http://rpc-restored', ws: 'ws://rpc-restored' },
      ],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('выполняется close → resubscribe → логируется reconnect', async () => {
    await handleDisconnect('rpc-d3');

    expect(rpcPoolCore.closeRpcPool).toHaveBeenCalled();

    expect(subscriptionManager.resubscribeAll).toHaveBeenCalled();

    expect(sharedLogger.sharedLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'info',
        message: expect.objectContaining({
          type: 'reconnect',
          rpc_id: 'rpc-d3',
        }),
      })
    );
  });
});
