import { Connection, PublicKey } from "@solana/web3.js";
import { subscribeToLogs, unsubscribeFromLogs } from "./subscriptionManager.js";
import { getMissedTransactions } from "./httpClient.js";
import { logger } from "./utils/logger.js";
import dotenv from "dotenv";

dotenv.config();

// 📌 **Глобальный перехват ошибок, чтобы процесс не падал**
process.on("uncaughtException", (err) => {
    logger.error(`[❌] Необработанная ошибка: ${err.message}`);
});

process.on("unhandledRejection", (reason, promise) => {
    logger.error(`[❌] Необработанный отказ в промисе: ${reason}`);
});

// 📌 **Список контрольных аккаунтов (должны быть всегда активны) из .env**
const CONTROL_ACCOUNTS = process.env.CONTROL_ACCOUNTS.split(",").map(acc => acc.trim());

// Подключение к WebSocket Solana
let connection = createConnection();

// Кэш подписок
let activeSubscriptions = new Map(); // { chain_id: { address: subscription_id } }
let newWebSocketTransactions = new Set(); // Кэш новых транзакций из WebSocket
let isRecoveringWebsocket = false; // 📌 **Флаг состояния восстановления**

// 📌 **Последнее время активности контрольных аккаунтов**
let lastControlActivity = Date.now();

// 📌 **Функция создания WebSocket-соединения с обработкой ошибок**
function createConnection() {
    const conn = new Connection(process.env.RPC_HTTP_URL, {
        wsEndpoint: process.env.RPC_WS_URL,
    });

    conn._rpcWebSocket.on("close", async () => {
        logger.warn("[⚠] WebSocket Solana отключился! Переподключаю через 5 секунд...");
        setTimeout(async () => {
            connection = createConnection();
            await restoreSubscriptions();
        }, 5000);
    });

    conn._rpcWebSocket.on("error", (err) => {
        logger.error(`[❌] Ошибка WebSocket: ${err.message}`);
    });

    return conn;
}

// 📌 **Добавляем подписку на все контрольные аккаунты**
for (const account of CONTROL_ACCOUNTS) {
    connection.onLogs(
        new PublicKey(account),
        (logInfo) => {
            logger.info(`[✅] Контрольный аккаунт ${account} получил транзакцию: ${logInfo.signature}`);
            lastControlActivity = Date.now(); // Обнуляем таймер "тишины"
        },
        "confirmed"
    );
}

// 📌 **Функция восстановления подписок после падения WebSocket**
async function restoreSubscriptions() {
    newWebSocketTransactions.clear(); // Очищаем перед новым подключением
    isRecoveringWebsocket = true;
    for (const [chain_id, subscriptions] of activeSubscriptions.entries()) {
        await subscribeToLogs(connection, chain_id, [...subscriptions.keys()], activeSubscriptions, isRecoveringWebsocket);
    }
    await recoverMissedTransactions();
    isRecoveringWebsocket = false;

    // 📌 **После восстановления отправляем отложенные транзакции в Redis**
    for (const tx of newWebSocketTransactions) {
        sendToRedisBuffer("solana_logs_stream", tx);
    }
    newWebSocketTransactions.clear();
}

// 📌 **Функция восстановления пропущенных транзакций**
async function recoverMissedTransactions() {
    logger.info("[🔄] Запрос пропущенных транзакций...");
    const missedTransactions = await getMissedTransactions(connection, activeSubscriptions, newWebSocketTransactions);
    
    for (const tx of missedTransactions) {
        sendToRedisBuffer("solana_logs_stream", tx);
    }
    
    logger.info("[✅] Восстановление завершено, теперь можно отправлять новые транзакции из WebSocket.");
}

// 📌 **Функция проверки "тишины"**
async function checkWebSocketHealth() {
    const now = Date.now();
    const silenceDuration = now - lastControlActivity;

    if (silenceDuration >= 5 * 60 * 1000) { // 5 минут без событий
        logger.warn("[⚠] Контрольные аккаунты молчат 5 минут. Проверяю их через HTTP...");

        let hasNewTransactions = false;

        for (const account of CONTROL_ACCOUNTS) {
            try {
                const signatures = await connection.getSignaturesForAddress(new PublicKey(account), { limit: 1 });
                if (signatures.length > 0) {
                    hasNewTransactions = true;
                    break;
                }
            } catch (error) {
                logger.error(`[❌] Ошибка проверки контрольного аккаунта ${account} через HTTP: ${error.message}`);
            }
        }

        if (hasNewTransactions) {
            logger.warn("[⚠] Обнаружены новые транзакции через HTTP, но WebSocket их не передаёт. Переподключаюсь...");
            connection = createConnection();
            await restoreSubscriptions();
        } else {
            logger.info("[✅] Контрольные аккаунты тоже пусты, WebSocket работает нормально.");
        }
    }
}

// 📌 **Запускаем проверку "тишины" каждую минуту**
setInterval(checkWebSocketHealth, 60 * 1000);

logger.info("[✅] Solana Subscriber запущен!");
