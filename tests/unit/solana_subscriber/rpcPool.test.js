import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/utils/sharedLogger.js', () => ({
  sharedLogger: vi.fn(),
}));

vi.mock('@/services/solana_subscriber/subscription/subscriptionManager.js', () => ({
  resubscribeAll: vi.fn(),
}));

vi.mock('@/services/solana_subscriber/config/configLoader.js', () => ({
  getCurrentConfig: () => ({
    rpc_endpoints: [{ http: 'https://rpc-1', ws: 'wss://rpc-1/ws' }],
  }),
}));

vi.mock('@/services/solana_subscriber/rpc/rpcPoolCore.js', () => {
  const clients = [];

  return {
    getAllRpcClients: () => clients,
    getWsConnections: () => clients.map(c => c.wsConn),
    getAvailableRpc: () => clients[0] || null,
    closeRpcPool: vi.fn(),
    initRpcPool: vi.fn((_endpoints, connectionFactory) => {
      const conn = connectionFactory('https://rpc-1', 'wss://rpc-1/ws');
      clients.length = 0;
      clients.push({
        id: 'rpc-1',
        httpConn: conn,
        wsConn: { _rpcWebSocket: { on: vi.fn(), rpcId: 'rpc-1' } },
        limiter: { removeToken: () => true },
      });
    }),
  };
});

vi.mock('@/services/solana_subscriber/rpc/connectionFactory.js', () => ({
  connectionFactory: (http, ws) => ({
    endpoint: http,
    _rpcWebSocket: {
      on: vi.fn(),
      rpcId: 'mock',
    },
  }),
}));

describe('rpcPool', () => {
  let rpcPool;

  beforeEach(async () => {
    vi.clearAllMocks();
    rpcPool = await import('@/services/solana_subscriber/rpc/rpcPool.js');
  });

  it('инициализирует RPC и подписывает ws события', async () => {
    await rpcPool.initRpcPool([
      { http: 'https://rpc-1', ws: 'wss://rpc-1/ws', rate_limits: { max_requests_per_sec: 10 } },
    ]);

    const clients = rpcPool.getAllRpcClients();
    expect(clients.length).toBe(1);
    expect(clients[0].id).toBe('rpc-1');
    expect(clients[0].wsConn._rpcWebSocket.on).toHaveBeenCalledWith('close', expect.any(Function));
    expect(clients[0].wsConn._rpcWebSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('handleDisconnect логирует отключение и пересоздаёт RPC', async () => {
    const { handleDisconnect } = rpcPool;
    const { sharedLogger } = await import('@/utils/sharedLogger.js');
    const { resubscribeAll } = await import('@/services/solana_subscriber/subscription/subscriptionManager.js');

    await handleDisconnect('rpc-1');

    expect(sharedLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({
          type: 'ws_disconnect',
          rpc_id: 'rpc-1',
        }),
      })
    );

    expect(sharedLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({
          type: 'reconnect',
          rpc_id: 'rpc-1',
        }),
      })
    );

    expect(resubscribeAll).toHaveBeenCalled();
  });
});

