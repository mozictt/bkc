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

// Pencocokan key persis untuk identitas kependudukan & asuransi agar kata seperti "klinik" tidak ikut tersensor
const EXACT_SENSITIVE_KEYS = new Set([
  'nik',
  'nokk',
  'no_kk',
  'nobpjs',
  'no_bpjs',
  'nokartu',
  'no_kartu',
  'nopaspor',
  'no_paspor',
  'noidentitaslain',
  'no_identitas_lain',
]);

/**
 * Menyensor data sensitif (seperti password, token, pin, nik, no_kk) secara rekursif
 * dan membatasi ukuran string panjang (seperti file base64).
 */
export function sanitizePayload(data: unknown): unknown {
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

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    const isSensitive =
      EXACT_SENSITIVE_KEYS.has(lowerKey) ||
      SENSITIVE_KEYS.some((sensitive) => lowerKey.includes(sensitive));

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
