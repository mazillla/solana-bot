import { createClient } from "redis";
import { sendToRedisBuffer } from "../utils/redis_buffer.js";
import dotenv from "dotenv";

dotenv.config();

const redisClient = createClient();
await redisClient.connect();

// 📌 **Глобальный перехват ошибок, чтобы процесс не падал**
process.on("uncaughtException", (err) => {
    console.error(`[❌] Необработанная ошибка: ${err.message}`);
});

process.on("unhandledRejection", (reason, promise) => {
    console.error(`[❌] Необработанный отказ в промисе: ${reason}`);
});

// Кэш подписок в памяти (для минимизации обращений к Redis)
let subscribedChains = new Map(); // { chain_id: Set(адреса) }

console.log("[✅] Account Manager запущен и слушает команды подписки...");

// 📌 **Восстанавливаем подписки из Redis при перезапуске**
async function restoreSubscriptions() {
    try {
        const keys = await redisClient.keys("subscribed_accounts_*");
        for (const key of keys) {
            const chain_id = key.replace("subscribed_accounts_", "");
            const accounts = JSON.parse(await redisClient.get(key)) || [];
            subscribedChains.set(chain_id, new Set(accounts));
            
            // 📌 **Отправляем подписки в solana_subscriber для восстановления через буфер**
            sendToRedisBuffer('subscribe_addresses_stream', { chain_id, accounts: JSON.stringify(accounts) });
            console.log(`[🔄] Восстановлены подписки для ${chain_id}: ${accounts.length} аккаунтов`);
        }
    } catch (error) {
        console.error("[❌] Ошибка восстановления подписок из Redis:", error.message);
    }
}

// Восстанавливаем подписки при запуске
await restoreSubscriptions();

// 📌 **Слушаем команды подписки от цепочек**
async function processSubscriptionMessages() {
    while (true) {
        try {
            const messages = await redisClient.xReadGroup('subscribe_addresses_stream_group', 'account_manager', [{ key: 'subscribe_addresses_stream', id: '>' }], { COUNT: 10, BLOCK: 5000 });
            if (!messages) continue;

            for (const message of messages[0].messages) {
                const { chain_id, action, accounts } = JSON.parse(message.message.accounts);

                if (!chain_id || !Array.isArray(accounts) || accounts.length === 0) {
                    console.warn("[⚠] Неверные данные подписки. Пропускаем сообщение.");
                    continue;
                }

                if (!subscribedChains.has(chain_id)) {
                    subscribedChains.set(chain_id, new Set());
                }

                let updated = false;
                const chainSubscriptions = subscribedChains.get(chain_id);

                if (action === "subscribe") {
                    for (const account of accounts) {
                        if (!chainSubscriptions.has(account)) {
                            chainSubscriptions.add(account);
                            updated = true;
                        }
                    }
                } else if (action === "unsubscribe") {
                    for (const account of accounts) {
                        if (chainSubscriptions.has(account)) {
                            chainSubscriptions.delete(account);
                            updated = true;
                        }
                    }
                }

                if (!updated) continue;

                await redisClient.set(`subscribed_accounts_${chain_id}`, JSON.stringify([...chainSubscriptions]));
                console.log(`[✅] Подписки обновлены для ${chain_id}: ${chainSubscriptions.size} аккаунтов`);

                sendToRedisBuffer('subscribe_addresses_stream', { chain_id, accounts: JSON.stringify([...chainSubscriptions]) });
                await redisClient.xAck('subscribe_addresses_stream', 'subscribe_addresses_stream_group', message.id);
            }
        } catch (error) {
            console.error("[❌] Ошибка обработки команды подписки:", error.message);
        }
    }
}

processSubscriptionMessages();
