import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleDisconnect } from '@/services/solana_subscriber/rpc/handleDisconnect.js';
import * as rpcPoolCore from '@/services/solana_subscriber/rpc/rpcPoolCore.js';
import * as subscriptionManager from '@/services/solana_subscriber/subscription/subscriptionManager.js';
import * as sharedLogger from '@/utils/sharedLogger.js';
import { getCurrentConfig } from '@/services/solana_subscriber/config/configLoader.js';

vi.mock('@/services/solana_subscriber/config/configLoader.js', () => ({
  getCurrentConfig: vi.fn(() => ({
    rpc_endpoints: [{ http: 'http://test-rpc', ws: 'ws://test-rpc' }],
  })),
}));

describe('S17: Подписка теряется и корректно восстанавливается', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(rpcPoolCore, 'closeRpcPool').mockResolvedValue();
    vi.spyOn(rpcPoolCore, 'initRpcPool').mockResolvedValue(); // 🧠 здесь!
    vi.spyOn(subscriptionManager, 'resubscribeAll').mockResolvedValue();
    vi.spyOn(sharedLogger, 'sharedLogger').mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('должен корректно обработать потерю подписки и восстановить её', async () => {
    await handleDisconnect('rpc-1');

    expect(rpcPoolCore.closeRpcPool).toHaveBeenCalled();

    expect(rpcPoolCore.initRpcPool).toHaveBeenCalledWith(
      [{ http: 'http://test-rpc', ws: 'ws://test-rpc' }],
      expect.any(Function)
    );

    expect(subscriptionManager.resubscribeAll).toHaveBeenCalled();

    expect(sharedLogger.sharedLogger).toHaveBeenCalledWith({
      service: 'solana_subscriber',
      level: 'warn',
      message: {
        type: 'ws_disconnect',
        rpc_id: 'rpc-1',
      },
    });

    expect(sharedLogger.sharedLogger).toHaveBeenCalledWith({
      service: 'solana_subscriber',
      level: 'info',
      message: {
        type: 'reconnect',
        rpc_id: 'rpc-1',
      },
    });
  });
});
