import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../utils/sharedLogger.js', () => ({
  sharedLogger: vi.fn(),
}));

vi.mock('../services/solana_subscriber/rpc/rpcLimiter.js', () => ({
  createLimiter: vi.fn(() => ({
    removeToken: vi.fn(() => true),
  })),
}));

import {
  initRpcPool,
  getAllRpcClients,
  getAvailableRpc,
  getWsConnections,
  closeRpcPool,
} from '../services/solana_subscriber/rpc/rpcPoolCore.js';

import { sharedLogger } from '../utils/sharedLogger.js';
import { createLimiter } from '../services/solana_subscriber/rpc/rpcLimiter.js';

describe('rpcPoolCore', () => {
  const mockConn = (type) => ({
    type,
    _rpcWebSocket: {
      close: vi.fn(),
    },
  });

  const mockFactory = (httpUrl, wsUrl) => {
    if (wsUrl) {
      return mockConn('ws');
    } else {
      return mockConn('http');
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('инициализирует пул с двумя RPC', async () => {
    const endpoints = [
      { http: 'http://1', ws: 'ws://1', rate_limits: { max_requests_per_sec: 15 } },
      { http: 'http://2', ws: 'ws://2' },
    ];

    await initRpcPool(endpoints, mockFactory);

    const clients = getAllRpcClients();
    expect(clients).toHaveLength(2);
    expect(clients[0].httpConn.type).toBe('http');
    expect(clients[0].wsConn.type).toBe('ws');
    expect(createLimiter).toHaveBeenCalledWith(15);
    expect(createLimiter).toHaveBeenCalledTimes(2);
  });

  it('возвращает список WebSocket соединений', async () => {
    await initRpcPool([{ http: 'http://x', ws: 'ws://x' }], mockFactory);
    const ws = getWsConnections();
    expect(ws).toHaveLength(1);
    expect(ws[0].type).toBe('ws');
  });

  it('getAvailableRpc возвращает первый с токеном', async () => {
    await initRpcPool([{ http: 'http://x', ws: 'ws://x' }], mockFactory);
    const rpc = await getAvailableRpc();
    expect(rpc).toBeDefined();
    expect(rpc.httpConn.type).toBe('http');
  });

  it('getAvailableRpc возвращает null, если removeToken = false', async () => {
    createLimiter.mockReturnValueOnce({ removeToken: () => false });

    await initRpcPool([{ http: 'http://z', ws: 'ws://z' }], mockFactory);
    const rpc = await getAvailableRpc();
    expect(rpc).toBeNull();
  });

  it('корректно закрывает все WebSocket соединения', async () => {
    await initRpcPool([{ http: 'http://c', ws: 'ws://c' }], mockFactory);
    const ws = getAllRpcClients()[0].wsConn._rpcWebSocket;
    const spy = vi.spyOn(ws, 'close');

    await closeRpcPool();
    expect(spy).toHaveBeenCalled();
  });

  it('если wsConn.close выбрасывает ошибку — sharedLogger логирует её', async () => {
    const mockConn = {
      type: 'ws',
      _rpcWebSocket: {
        close: vi.fn(() => {
          throw new Error('close failed');
        }),
      },
    };

    const fakeFactory = () => mockConn;

    await initRpcPool([{ http: 'http://error', ws: 'ws://error' }], fakeFactory);
    await closeRpcPool();

    expect(sharedLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'warn',
        message: expect.objectContaining({
          type: 'ws_close_failed',
          rpc_id: 'rpc-1',
          error: 'close failed',
        }),
      })
    );
  });
});
