import { logger } from "./utils/logger.js";

// 📌 **Глобальный перехват ошибок, чтобы процесс не падал**
process.on("uncaughtException", (err) => {
    logger.error(`[❌] Необработанная ошибка: ${err.message}`);
});

process.on("unhandledRejection", (reason, promise) => {
    logger.error(`[❌] Необработанный отказ в промисе: ${reason}`);
});

// Кэш подписок в памяти
let subscriptions = new Map(); // { chain_id: { address: subscription_id } }
let newWebSocketTransactions = new Set(); // Кэш новых транзакций во время восстановления

// 📌 **Функция подписки на логи Solana**
export async function subscribeToLogs(connection, chain_id, accounts, redisClient, activeSubscriptions, isRecoveringWebsocket) {
    if (!activeSubscriptions.has(chain_id)) {
        activeSubscriptions.set(chain_id, new Map());
    }

    const chainSubscriptions = activeSubscriptions.get(chain_id);

    for (const account of accounts) {
        if (!chainSubscriptions.has(account)) {
            try {
                const id = connection.onLogs(
                    new PublicKey(account),
                    (logInfo) => {
                        if (!isRecoveringWebsocket) {
                            sendToRedisBuffer(`solana_logs_${chain_id}`, { chain_id, account, log: logInfo });
                        } else {
                            newWebSocketTransactions.add(logInfo);
                        }
                    },
                    "confirmed"
                );
                chainSubscriptions.set(account, id);
                logger.info(`[✅] Подписан на ${account} для ${chain_id}`);
            } catch (error) {
                logger.error(`[❌] Ошибка подписки ${account}: ${error.message}`);
            }
        }
    }
}

// 📌 **Функция отписки от логов Solana**
export async function unsubscribeFromLogs(connection, chain_id, accounts, activeSubscriptions) {
    if (!activeSubscriptions.has(chain_id)) return;
    
    const chainSubscriptions = activeSubscriptions.get(chain_id);

    for (const account of accounts) {
        if (chainSubscriptions.has(account)) {
            try {
                const subscriptionId = chainSubscriptions.get(account);
                connection.removeOnLogsListener(subscriptionId); // Удаляем подписку в WebSocket
                chainSubscriptions.delete(account); // Удаляем из списка активных подписок
                logger.info(`[❌] Отписан от ${account} для цепочки ${chain_id}`);
            } catch (error) {
                logger.error(`[❌] Ошибка отписки ${account}: ${error.message}`);
            }
        }
    }
}
