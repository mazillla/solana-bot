// простой токен-бакет лимитер
export function createLimiter(maxRequestsPerSec) {
    let tokens = maxRequestsPerSec;
    const interval = setInterval(() => {
      tokens = maxRequestsPerSec;
    }, 1000);
  
    return {
      removeToken() {
        if (tokens > 0) {
          tokens--;
          return true;
        }
        return false;
      },
      stop() {
        clearInterval(interval);
      },
    };
  }
  