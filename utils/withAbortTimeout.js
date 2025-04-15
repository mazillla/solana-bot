// utils/withAbortTimeout.js

export function withAbortTimeout(promiseFn, timeoutMs = 5000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
  
    return promiseFn(controller.signal)
      .finally(() => clearTimeout(timeout));
  }
  