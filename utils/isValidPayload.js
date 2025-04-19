// utils/isValidPayload.js
export function isValidPayload(obj) {
    return obj !== null && typeof obj === 'object' && !Array.isArray(obj);
  }
  