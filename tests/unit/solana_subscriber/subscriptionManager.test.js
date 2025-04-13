import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/solana_subscriber/rpc/rpcPoolCore.js', () => ({
    getAvailableRpc: vi.fn(),
  }));
  
//   vi.mock('../../\1', () => ({
//     sharedLogger: vi.fn(),
//   }));
  
  vi.mock('@/services/solana_subscriber/subscription/onLogsHandler.js', () => ({
    handleLogEvent: vi.fn(),
  }));
  
  vi.mock('@/services/solana_subscriber/subscription/recoveryManager.js', () => ({
    recoverTransactions: vi.fn(),
  }));
  
  vi.mock('@/services/solana_subscriber/db/subscriptions.js', () => ({
    getLastSignatureForAccount: vi.fn(),
  }));
  
  import {
    subscribeToAccount,
    unsubscribeFromAccount,
    startAllSubscriptions,
    stopAllSubscriptions,
    __activeSubscriptions,
  } from '@/services/solana_subscriber/subscription/subscriptionManager.js';
  
  import { getAvailableRpc } from '@/services/solana_subscriber/rpc/rpcPoolCore.js';
  import { sharedLogger } from '@/utils/sharedLogger.js';
  import { handleLogEvent } from '@/services/solana_subscriber/subscription/onLogsHandler.js';
  import { recoverTransactions } from '@/services/solana_subscriber/subscription/recoveryManager.js';
  import { getLastSignatureForAccount } from '@/services/solana_subscriber/db/subscriptions.js';
  import { resubscribeAll } from '@/services/solana_subscriber/subscription/subscriptionManager.js';
  
  describe('subscriptionManager', () => {
    const mockRpc = {
      id: 'rpc-1',
      wsConn: {
        onLogs: vi.fn(() => 'sub-id-123'),
        removeOnLogsListener: vi.fn(),
      },
    };
  
    const subData = {
      chain_id: 'chain1',
      account: 'Account1111111111111111111111111111111',
      subscription_type: 'regular',
    };
  
    beforeEach(() => {
      vi.clearAllMocks();
      __activeSubscriptions.clear();
    });
  
    it('должна подписаться на аккаунт через subscribeToAccount()', async () => {
      getAvailableRpc.mockResolvedValue(mockRpc);
      getLastSignatureForAccount.mockResolvedValue('sig123');
  
      await subscribeToAccount(subData);
  
      const key = `${subData.chain_id}:${subData.account}`;
      expect(__activeSubscriptions.has(key)).toBe(true);
      expect(mockRpc.wsConn.onLogs).toHaveBeenCalled();
      expect(sharedLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.objectContaining({ type: 'subscribe' }),
        })
      );
    });
  
    it('не должна подписываться, если нет доступного RPC', async () => {
      getAvailableRpc.mockResolvedValue(null);
  
      await subscribeToAccount(subData);
  
      expect(sharedLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.objectContaining({
            type: 'subscribe_skipped',
            reason: 'no_available_rpc',
          }),
        })
      );
      expect(__activeSubscriptions.size).toBe(0);
    });
  
    it('должна отписываться от аккаунта через unsubscribeFromAccount()', async () => {
      getAvailableRpc.mockResolvedValue(mockRpc);
      getLastSignatureForAccount.mockResolvedValue('sig123');
  
      await subscribeToAccount(subData);
      const key = `${subData.chain_id}:${subData.account}`;
      await unsubscribeFromAccount(key);
  
      expect(mockRpc.wsConn.removeOnLogsListener).toHaveBeenCalledWith('sub-id-123');
      expect(__activeSubscriptions.has(key)).toBe(false);
      expect(sharedLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.objectContaining({ type: 'unsubscribe' }),
        })
      );
    });
  
    it('должна вызвать unsubscribe_failed при ошибке', async () => {
      getAvailableRpc.mockResolvedValue(mockRpc);
      getLastSignatureForAccount.mockResolvedValue('sig123');
  
      await subscribeToAccount(subData);
      const key = `${subData.chain_id}:${subData.account}`;
  
      mockRpc.wsConn.removeOnLogsListener.mockImplementation(() => {
        throw new Error('fail');
      });
  
      await unsubscribeFromAccount(key);
  
      expect(sharedLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.objectContaining({
            type: 'unsubscribe_failed',
            error: 'fail',
          }),
        })
      );
    });
  
    it('должна подписать все аккаунты через startAllSubscriptions()', async () => {
      getAvailableRpc.mockResolvedValue(mockRpc);
      getLastSignatureForAccount.mockResolvedValue('sig123');
  
      await startAllSubscriptions([subData]);
  
      const key = `${subData.chain_id}:${subData.account}`;
      expect(__activeSubscriptions.has(key)).toBe(true);
    });
  
    it('должна отписать все аккаунты через stopAllSubscriptions()', async () => {
      getAvailableRpc.mockResolvedValue(mockRpc);
      getLastSignatureForAccount.mockResolvedValue('sig123');
  
      await subscribeToAccount(subData);
      expect(__activeSubscriptions.size).toBe(1);
  
      await stopAllSubscriptions();
      expect(__activeSubscriptions.size).toBe(0);
    });

    it('должна вызывать handleLogEvent при получении логов', async () => {
        const fakeWs = {
          onLogs: vi.fn(),
          _rpcWebSocket: {},
        };
      
        // перехватываем функцию, которая будет вызвана из onLogs
        let logsCallback;
        fakeWs.onLogs.mockImplementation((_account, cb) => {
          logsCallback = cb;
          return 'sub-id';
        });
      
        getAvailableRpc.mockResolvedValue({
          id: 'rpc-xyz',
          wsConn: fakeWs,
        });
      
        getLastSignatureForAccount.mockResolvedValue('abc123');
      
        await subscribeToAccount({
          chain_id: 'chainX',
          account: 'Acct1111111111111111111111111111111',
          subscription_type: 'regular',
        });
      
        // Эмулируем получение логов
        const mockLogInfo = { signature: 'sig123', err: null };
        await logsCallback(mockLogInfo);
      
        expect(handleLogEvent).toHaveBeenCalledWith({
          chain_id: 'chainX',
          account: 'Acct1111111111111111111111111111111',
          signature: 'sig123',
          subscription_type: 'regular',
          rpc: expect.any(Object),
        });
    });
    
    it('должна пересоздать подписки через resubscribeAll()', async () => {
        getAvailableRpc.mockResolvedValue({
          id: 'rpc-2',
          wsConn: {
            onLogs: vi.fn(() => 'sub-id-xyz'),
            _rpcWebSocket: {},
            removeOnLogsListener: vi.fn(),
          },
        });
      
        getLastSignatureForAccount.mockResolvedValue('sigX');
      
        const account = 'AcctX';
        const chain_id = 'chainX';
      
        await subscribeToAccount({
          chain_id,
          account,
          subscription_type: 'regular',
        });
      
        expect(__activeSubscriptions.size).toBe(1);
      
        await resubscribeAll();
      
        // Должны пересоздаться
        expect(sharedLogger).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.objectContaining({
              type: 'resubscribe',
              chain_id,
              account,
            }),
          })
        );
      
        expect(__activeSubscriptions.size).toBe(1);
    });
    it('не должна подписывать аккаунт повторно, если уже есть активная подписка', async () => {
        getAvailableRpc.mockResolvedValue({
          id: 'rpc-1',
          wsConn: {
            onLogs: vi.fn(() => 'sub-id'),
            _rpcWebSocket: {},
          },
        });
        getLastSignatureForAccount.mockResolvedValue('sig123');
      
        const sub = {
          chain_id: 'chainX',
          account: 'Acc111',
          subscription_type: 'regular',
        };
      
        await subscribeToAccount(sub);
        const countBefore = __activeSubscriptions.size;
      
        await subscribeToAccount(sub); // второй вызов — не должен ничего делать
      
        expect(__activeSubscriptions.size).toBe(countBefore);
    });
    
    it('не вызывает recoverTransactions, если нет сигнатуры и тип не regular', async () => {
        getAvailableRpc.mockResolvedValue({
          id: 'rpc-1',
          wsConn: {
            onLogs: vi.fn(() => 'sub-id'),
            _rpcWebSocket: {},
          },
        });
      
        getLastSignatureForAccount.mockResolvedValue(null); // <-- важный момент
      
        await subscribeToAccount({
          chain_id: 'chainZ',
          account: 'Acc222',
          subscription_type: 'backfill', // не regular
          last_signature: null,          // сигнатуры нет
        });
      
        expect(recoverTransactions).not.toHaveBeenCalled();
    });
    
    it('не вызывает handleLogEvent, если лог содержит ошибку или нет сигнатуры', async () => {
        const ws = {
          onLogs: vi.fn(),
          _rpcWebSocket: {},
        };
      
        let logCallback;
        ws.onLogs.mockImplementation((_acc, cb) => {
          logCallback = cb;
          return 'sub-id';
        });
      
        getAvailableRpc.mockResolvedValue({ id: 'rpc-2', wsConn: ws });
        getLastSignatureForAccount.mockResolvedValue('sig');
      
        await subscribeToAccount({
          chain_id: 'chainY',
          account: 'AccX',
          subscription_type: 'regular',
        });
      
        // Эмуляция случая без сигнатуры
        await logCallback({ err: null });
      
        // Эмуляция случая с ошибкой
        await logCallback({ signature: 'sig123', err: new Error('fail') });
      
        expect(handleLogEvent).not.toHaveBeenCalled();
    });

    it('не вызывает removeOnLogsListener, если подписка не найдена', async () => {
        await unsubscribeFromAccount('nonexistent:account');
    
        expect(sharedLogger).not.toHaveBeenCalled();
    });
      
});
  