import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  initRpcPool,
  handleDisconnect,
  __setReconnectInProgress,
} from '@/services/solana_subscriber/rpc/rpcPool.js';
import { Connection } from '@solana/web3.js'; // для проверки вызова

vi.mock('@solana/web3.js', () => ({
  Connection: vi.fn().mockImplementation(() => ({ _dummy: true })),
}));

const mockLogger = vi.fn();
const mockResubscribeAll = vi.fn();
const mockCloseRpcPool = vi.fn();
const mockInitCore = vi.fn();

vi.mock('@/utils/sharedLogger.js', () => ({
  sharedLogger: vi.fn(),
}));

vi.mock('@/services/solana_subscriber/subscription/subscriptionManager.js', () => ({
  resubscribeAll: vi.fn(),
}));

vi.mock('@/services/solana_subscriber/rpc/rpcPoolCore.js', () => ({
  initRpcPool: vi.fn(),
  getAllRpcClients: vi.fn(),
  getAvailableRpc: vi.fn(),
  getWsConnections: vi.fn(),
  closeRpcPool: vi.fn(),
}));

vi.mock('@/services/solana_subscriber/config/configLoader.js', async () => ({
  getCurrentConfig: async () => ({
    rpc_endpoints: ['http://mock.rpc'],
  }),
}));

import * as rpcPoolCore from '@/services/solana_subscriber/rpc/rpcPoolCore.js';
import * as subscriptionManager from '@/services/solana_subscriber/subscription/subscriptionManager.js';
import * as sharedLoggerModule from '@/utils/sharedLogger.js';

describe('rpcPool.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    rpcPoolCore.initRpcPool.mockImplementation(mockInitCore);
    rpcPoolCore.getAllRpcClients.mockReturnValue([
      {
        id: 'mock-rpc',
        wsConn: {
          _rpcWebSocket: {
            on: vi.fn(),
          },
        },
      },
    ]);

    rpcPoolCore.closeRpcPool.mockImplementation(mockCloseRpcPool);
    subscriptionManager.resubscribeAll.mockImplementation(mockResubscribeAll);
    sharedLoggerModule.sharedLogger.mockImplementation(mockLogger);

    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('initRpcPool initializes pool and attaches event handlers', async () => {
    await initRpcPool(['http://localhost:8899']);

    expect(mockInitCore).toHaveBeenCalled();

    const client = rpcPoolCore.getAllRpcClients()[0];
    expect(client.wsConn._rpcWebSocket.on).toHaveBeenCalledWith('close', expect.any(Function));
    expect(client.wsConn._rpcWebSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
    expect(console.log).toHaveBeenCalledWith(expect.stringMatching(/^🌐 Инициализировано/));

    // 🔍 вызываем переданный connectionFactory вручную
    const passedFactory = mockInitCore.mock.calls[0][1];
    passedFactory('http://localhost:8899');

    expect(Connection).toHaveBeenCalledWith('http://localhost:8899', {
      commitment: 'confirmed',
    });
  });

  it('handleDisconnect triggers reconnect flow', async () => {
    await handleDisconnect('rpc-1');

    expect(mockLogger).toHaveBeenCalledWith(expect.objectContaining({
      level: 'warn',
      message: expect.objectContaining({ type: 'ws_disconnect' }),
    }));

    expect(mockCloseRpcPool).toHaveBeenCalled();
    expect(mockInitCore).toHaveBeenCalledWith(['http://mock.rpc'], expect.any(Function));
    expect(mockResubscribeAll).toHaveBeenCalled();

    expect(mockLogger).toHaveBeenCalledWith(expect.objectContaining({
      level: 'info',
      message: expect.objectContaining({ type: 'reconnect' }),
    }));
  });

  it('handleDisconnect logs reconnect_failed on error', async () => {
    rpcPoolCore.closeRpcPool.mockRejectedValueOnce(new Error('test error'));

    await handleDisconnect('rpc-err');

    expect(mockLogger).toHaveBeenCalledWith(expect.objectContaining({
      level: 'error',
      message: expect.objectContaining({
        type: 'reconnect_failed',
        rpc_id: 'rpc-err',
        error: 'test error',
      }),
    }));
  });

  it('handleDisconnect does nothing if reconnect already in progress', async () => {
    __setReconnectInProgress(true);

    await handleDisconnect('rpc-id');

    expect(mockLogger).not.toHaveBeenCalled();

    __setReconnectInProgress(false);
  });
});
