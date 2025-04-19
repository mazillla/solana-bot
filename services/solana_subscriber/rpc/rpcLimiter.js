// services/solana_subscriber/rpc/rpcLimiter.js

// ✅ ГОТОВ

/**
 * 🧠 Этот модуль реализует простой алгоритм token bucket (токен-бакет),
 * используемый для ограничения количества RPC-запросов в секунду.
 *
 * 🔄 Логика:
 *   - В начале интервала (1 секунда) в "баке" maxRequestsPerSec токенов.
 *   - Каждый вызов removeToken() забирает 1 токен.
 *   - Если токены закончились — запрос отклоняется (false).
 *   - Каждую секунду бак автоматически пополняется до максимума.
 *
 * 📦 Используется для:
 *   - HTTP-запросов (getParsedTransaction)
 *   - WebSocket-событий (onLogs)
 * 
 * 📌 Независимо создаётся для каждого RPC клиента:
 *   - httpLimiter — в parseQueue / recovery
 *   - wsLimiter   — в onLogsHandler
 */

/**
 * 🛠 Создаёт лимитер с заданным количеством разрешённых запросов в секунду.
 * 
 * @param {number} maxRequestsPerSec - Максимум запросов в секунду
 * @returns {{
*   removeToken: () => boolean,
*   stop: () => void
* }}
*/
export function createLimiter(maxRequestsPerSec) {
 // 🪙 Сколько токенов (запросов) осталось в текущем окне
 let tokens = maxRequestsPerSec;

 // ⏱ Каждую секунду обнуляем счётчик и выдаём новые токены
 const interval = setInterval(() => {
   tokens = maxRequestsPerSec;
 }, 1000);

 return {
   /**
    * 🔄 Пытается забрать токен (разрешение на запрос).
    * @returns {boolean} - true если разрешено, false если лимит исчерпан
    */
   removeToken() {
     if (tokens > 0) {
       tokens--;
       return true;
     }
     return false;
   },

   /**
    * 🛑 Останавливает интервал (например, при завершении работы RPC).
    */
   stop() {
     clearInterval(interval);
   },
 };
}
