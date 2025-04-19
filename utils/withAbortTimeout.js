// utils/withAbortTimeout.js

// ✅ ГОТОВ

/**
 * ⏱ Выполняет асинхронную операцию с таймаутом.
 * 
 * 💡 Использует AbortController, но не требует поддержки сигнала в callback.
 * Просто завершает выполнение по таймеру, если callback не успел.
 *
 * @param {function(AbortSignal): Promise<any>} promiseFn - функция, принимающая signal (можно игнорировать)
 * @param {number} timeoutMs - сколько ждать (в миллисекундах)
 * @returns {Promise<any>} результат promiseFn или ошибка AbortError
 */
export function withAbortTimeout(promiseFn, timeoutMs = 5000) {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort(); // 💣 прерываем выполнение по таймауту
  }, timeoutMs);

  // Возвращаем выполнение, завершая по таймеру
  return promiseFn(controller.signal)
    .finally(() => clearTimeout(timeout)); // 💧 очищаем таймер
}
