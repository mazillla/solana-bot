import { createClient } from "redis";
import { logger } from "../utils/logger.js";
import { sendToRedisBuffer } from "../utils/redis_buffer.js";
import dotenv from "dotenv";

dotenv.config();

const redisClient = createClient();
await redisClient.connect();

// 📌 **Глобальный перехват ошибок, чтобы процесс не падал**
process.on("uncaughtException", (err) => {
    logger.error(`[❌] Необработанная ошибка: ${err.message}`);
});

process.on("unhandledRejection", (reason, promise) => {
    logger.error(`[❌] Необработанный отказ в промисе: ${reason}`);
});

console.log("[✅] Log Processor запущен и слушает события Solana...");

// 📌 **Слушаем события из Redis Streams**
async function processLogMessages() {
    while (true) {
        try {
            const messages = await redisClient.xReadGroup('solana_logs_stream_group', 'log_processor', [{ key: 'solana_logs_stream', id: '>' }], { COUNT: 10, BLOCK: 5000 });
            if (!messages) continue;

            for (const message of messages[0].messages) {
                try {
                    const { chain_id, account, log } = JSON.parse(message.message.message);
                    logger.info(`[📩] Лог получен: Chain: ${chain_id} | Account: ${account} | Tx: ${log.signature}`);
                    await redisClient.xAck('solana_logs_stream', 'solana_logs_stream_group', message.id);
                } catch (error) {
                    logger.error("[❌] Ошибка обработки лога:", error.message);
                }
            }
        } catch (error) {
            logger.error("[❌] Ошибка чтения из Redis Streams:", error.message);
        }
    }
}

processLogMessages();
