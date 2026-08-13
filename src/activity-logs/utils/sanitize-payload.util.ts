const SENSITIVE_KEYS = [
  'password',
  'pass',
  'oldpassword',
  'newpassword',
  'confirmpassword',
  'token',
  'refreshtoken',
  'secret',
  'authorization',
  'creditcard',
  'cardnumber',
  'cvv',
  'pin',
];

/**
 * Menyensor data sensitif (seperti password, token, pin) secara rekursif
 * dan membatasi ukuran string panjang (seperti file base64).
 */
export function sanitizePayload(data: any): any {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    // Jika string berupa base64 atau terlalu panjang, potong informasinya
    if (data.length > 500) {
      return `[DATA_TRUNCATED: ${data.length} chars]`;
    }
    return data;
  }

  if (typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizePayload(item));
  }

  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_KEYS.some((sensitive) =>
      lowerKey.includes(sensitive),
    );

    if (isSensitive) {
      sanitized[key] = '***SENSITIVE***';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizePayload(value);
    } else if (typeof value === 'string' && value.length > 500) {
      sanitized[key] = `[DATA_TRUNCATED: ${value.length} chars]`;
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}
