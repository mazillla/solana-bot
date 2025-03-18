import { createClient } from "redis";
import { logger } from "../utils/logger.js";

const redisClient = createClient();
await redisClient.connect();

// 📌 **Глобальный перехват ошибок, чтобы процесс не падал**
process.on("uncaughtException", (err) => {
    logger.error(`[❌] Необработанная ошибка: ${err.message}`);
});

process.on("unhandledRejection", (reason, promise) => {
    logger.error(`[❌] Необработанный отказ в промисе: ${reason}`);
});

// 📌 **Очередь для временного хранения сообщений, если Redis недоступен**
let messageBuffer = new Map(); // { stream_name: [messages] }

// 📌 **Функция отправки сообщения в Redis Streams с резервированием**
export async function sendToRedisBuffer(stream, message) {
    try {
        await redisClient.xAdd(stream, "*", { message: JSON.stringify(message) });
    } catch (error) {
        logger.error(`[❌] Ошибка записи в Redis Streams (${stream}): ${error.message}`);
        if (!messageBuffer.has(stream)) {
            messageBuffer.set(stream, []);
        }
        messageBuffer.get(stream).push(message);
    }
}

// 📌 **Функция отправки отложенных сообщений после восстановления Redis**
async function flushBuffer() {
    for (const [stream, messages] of messageBuffer.entries()) {
        while (messages.length > 0) {
            try {
                const message = messages.shift();
                await redisClient.xAdd(stream, "*", { message: JSON.stringify(message) });
            } catch (error) {
                logger.error(`[❌] Ошибка при отправке отложенного сообщения в Redis Streams (${stream}): ${error.message}`);
                messages.unshift(message); // Возвращаем сообщение в очередь
                break; // Останавливаем обработку, если Redis всё ещё нестабилен
            }
        }
        if (messages.length === 0) {
            messageBuffer.delete(stream); // Очищаем очередь после успешной отправки
        }
    }
}

// 📌 **Фоновая проверка состояния Redis и отправка отложенных сообщений**
setInterval(async () => {
    try {
        await redisClient.ping(); // Проверяем доступность Redis
        await flushBuffer();
    } catch (error) {
        logger.error("[⚠] Redis всё ещё недоступен, ждём восстановления...");
    }
}, 5000); // Проверяем каждые 5 секунд

logger.info("[✅] Redis Buffer запущен!");
