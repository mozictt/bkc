import { BadRequestException } from '@nestjs/common';
import { FormatNoRm } from '../master-simrs/constants/simrs.enum';

export type TenantNoRmPresetKode = 'PLAIN_8' | 'PLAIN_4' | 'DASH_6' | 'CUSTOM';

export interface NoRmFormatPattern {
  jumlahDigit: number;
  prefix?: string | null;
  suffix?: string | null;
  panjangBlok?: number | null;
  pemisahBlok?: '-' | '.' | '/' | string | null;
}

export interface TenantNoRmSetting extends NoRmFormatPattern {
  mode: 'PRESET' | 'CUSTOM';
  presetKode: TenantNoRmPresetKode;
  prefix: string | null;
  suffix: string | null;
  panjangBlok: number | null;
  pemisahBlok: '-' | '.' | '/' | null;
  izinkanPilihFormatDiPendaftaran: boolean;
}

export interface TenantPendaftaranSetting {
  judulHalaman: string;
  subjudulHalaman: string;
  judulHalamanSukses: string;
  subjudulHalamanSukses: string;
}

export interface NormalizedTenantSettings {
  noRm: TenantNoRmSetting;
  pendaftaran: TenantPendaftaranSetting;
  [key: string]: unknown;
}

export const NO_RM_PRESET_PATTERNS: Record<
  Exclude<TenantNoRmPresetKode, 'CUSTOM'>,
  NoRmFormatPattern
> = {
  PLAIN_8: {
    jumlahDigit: 8,
    prefix: null,
    suffix: null,
    panjangBlok: null,
    pemisahBlok: null,
  },
  DASH_6: {
    jumlahDigit: 6,
    prefix: null,
    suffix: null,
    panjangBlok: 2,
    pemisahBlok: '-',
  },
  PLAIN_4: {
    jumlahDigit: 4,
    prefix: null,
    suffix: null,
    panjangBlok: null,
    pemisahBlok: null,
  },
};

export const DEFAULT_TENANT_SETTINGS: {
  noRm: TenantNoRmSetting;
  pendaftaran: TenantPendaftaranSetting;
} = {
  noRm: {
    mode: 'PRESET',
    presetKode: 'PLAIN_8',
    jumlahDigit: 8,
    prefix: null,
    suffix: null,
    panjangBlok: null,
    pemisahBlok: null,
    izinkanPilihFormatDiPendaftaran: false,
  },
  pendaftaran: {
    judulHalaman: 'Pendaftaran Kunjungan Pasien',
    subjudulHalaman:
      'Formulir terpadu pendaftaran pasien baru maupun pasien lama (pilih pasien lama & dokter melalui popup)',
    judulHalamanSukses: 'Informasi Pasien yang Didaftarkan',
    subjudulHalamanSukses:
      'Ringkasan hasil registrasi kunjungan pasien beserta opsi cetak nomor antrean dan slip pendaftaran',
  },
};

/**
 * Memformat angka counter counter_key 'NO_RM' menjadi Nomor RM sesuai pola konfigurasi tenant.
 */
export function formatNoRmFromConfig(
  seq: number,
  pattern: NoRmFormatPattern,
): string {
  const safeSeq = Math.max(0, Math.floor(Number.isFinite(seq) ? seq : 0));
  const digitsCount = Math.max(
    1,
    Math.min(12, Math.floor(Number(pattern.jumlahDigit) || 8)),
  );
  const rawDigits = String(safeSeq).padStart(digitsCount, '0');

  let formattedDigits = rawDigits;
  const blockSize =
    pattern.panjangBlok && Number(pattern.panjangBlok) >= 2
      ? Math.floor(Number(pattern.panjangBlok))
      : null;

  if (blockSize) {
    const separator = pattern.pemisahBlok?.trim() || '-';
    const remainder = rawDigits.length % blockSize;
    const padded =
      remainder === 0
        ? rawDigits
        : rawDigits.padStart(rawDigits.length + (blockSize - remainder), '0');

    const chunks: string[] = [];
    for (let i = 0; i < padded.length; i += blockSize) {
      chunks.push(padded.slice(i, i + blockSize));
    }
    formattedDigits = chunks.join(separator);
  }

  const prefix = pattern.prefix?.trim() ?? '';
  const suffix = pattern.suffix?.trim() ?? '';
  return `${prefix}${formattedDigits}${suffix}`;
}

const isRecord = (val: unknown): val is Record<string, unknown> =>
  Boolean(val) && typeof val === 'object' && !Array.isArray(val);

const sanitizeOptionalAffix = (val: unknown): string | null => {
  if (typeof val !== 'string') return null;
  const trimmed = val.trim();
  return trimmed === '' ? null : trimmed.slice(0, 6);
};

const sanitizeDelimiter = (val: unknown): '-' | '.' | '/' | null => {
  if (val === '-' || val === '.' || val === '/') return val;
  return null;
};

const sanitizeLabelText = (
  val: unknown,
  fallback: string,
  maxLen: number,
): string => {
  if (typeof val !== 'string') return fallback;
  const trimmed = val.trim();
  return trimmed === '' ? fallback : trimmed.slice(0, maxLen);
};

/**
 * Menormalkan object JSONB `tenants.settings` dengan fallback aman dan tetap mempertahankan key lain.
 */
export function normalizeTenantSettings(
  rawSettings?: Record<string, unknown> | null,
): NormalizedTenantSettings {
  const source = isRecord(rawSettings) ? rawSettings : {};
  const rawNoRm = isRecord(source.noRm) ? source.noRm : {};
  const rawPendaftaran = isRecord(source.pendaftaran) ? source.pendaftaran : {};

  // Backward compatibility jika tenant baru punya legacy key `noRmFormat`
  const legacyFormat = source.noRmFormat;
  const defaultPreset: TenantNoRmPresetKode =
    legacyFormat === FormatNoRm.DASH_6 ? 'DASH_6' : 'PLAIN_8';

  const rawPreset = rawNoRm.presetKode;
  const presetKode: TenantNoRmPresetKode =
    rawPreset === 'PLAIN_8' ||
    rawPreset === 'PLAIN_4' ||
    rawPreset === 'DASH_6' ||
    rawPreset === 'CUSTOM'
      ? rawPreset
      : isRecord(source.noRm)
        ? 'CUSTOM'
        : defaultPreset;

  const mode: 'PRESET' | 'CUSTOM' =
    presetKode === 'CUSTOM' || rawNoRm.mode === 'CUSTOM' ? 'CUSTOM' : 'PRESET';

  const presetBase =
    presetKode !== 'CUSTOM' && mode === 'PRESET'
      ? NO_RM_PRESET_PATTERNS[presetKode]
      : null;

  const digitsRaw = Number(rawNoRm.jumlahDigit);
  const jumlahDigit =
    presetBase?.jumlahDigit ??
    (Number.isInteger(digitsRaw) && digitsRaw >= 3 && digitsRaw <= 12
      ? digitsRaw
      : DEFAULT_TENANT_SETTINGS.noRm.jumlahDigit);

  const rawBlock = presetBase
    ? presetBase.panjangBlok
    : rawNoRm.panjangBlok === null || rawNoRm.panjangBlok === undefined
      ? null
      : Number(rawNoRm.panjangBlok);

  const panjangBlok =
    rawBlock && Number.isInteger(rawBlock) && rawBlock >= 2 && rawBlock <= 6
      ? rawBlock
      : null;

  const pemisahBlok = panjangBlok
    ? sanitizeDelimiter(
        presetBase ? presetBase.pemisahBlok : rawNoRm.pemisahBlok,
      ) || '-'
    : null;

  const noRm: TenantNoRmSetting = {
    mode,
    presetKode: mode === 'PRESET' && presetKode !== 'CUSTOM' ? presetKode : 'CUSTOM',
    jumlahDigit,
    prefix: presetBase
      ? (presetBase.prefix ?? null)
      : sanitizeOptionalAffix(rawNoRm.prefix),
    suffix: presetBase
      ? (presetBase.suffix ?? null)
      : sanitizeOptionalAffix(rawNoRm.suffix),
    panjangBlok,
    pemisahBlok,
    izinkanPilihFormatDiPendaftaran: Boolean(
      rawNoRm.izinkanPilihFormatDiPendaftaran,
    ),
  };

  const pendaftaran: TenantPendaftaranSetting = {
    judulHalaman: sanitizeLabelText(
      rawPendaftaran.judulHalaman,
      DEFAULT_TENANT_SETTINGS.pendaftaran.judulHalaman,
      120,
    ),
    subjudulHalaman: sanitizeLabelText(
      rawPendaftaran.subjudulHalaman,
      DEFAULT_TENANT_SETTINGS.pendaftaran.subjudulHalaman,
      300,
    ),
    judulHalamanSukses: sanitizeLabelText(
      rawPendaftaran.judulHalamanSukses,
      DEFAULT_TENANT_SETTINGS.pendaftaran.judulHalamanSukses,
      120,
    ),
    subjudulHalamanSukses: sanitizeLabelText(
      rawPendaftaran.subjudulHalamanSukses,
      DEFAULT_TENANT_SETTINGS.pendaftaran.subjudulHalamanSukses,
      300,
    ),
  };

  return {
    ...source,
    noRm,
    pendaftaran,
  };
}

/**
 * Validasi pola penomoran No. RM agar panjang output valid untuk kolom `pasien.no_rm` (max 30 karakter).
 */
export function validateTenantNoRmSetting(pattern: TenantNoRmSetting): void {
  if (pattern.jumlahDigit < 3 || pattern.jumlahDigit > 12) {
    throw new BadRequestException('Jumlah digit No. RM harus antara 3 sampai 12.');
  }

  if (pattern.panjangBlok && pattern.panjangBlok > pattern.jumlahDigit) {
    throw new BadRequestException(
      `Panjang blok (${pattern.panjangBlok}) tidak boleh melebihi jumlah digit (${pattern.jumlahDigit}).`,
    );
  }

  const preview = formatNoRmFromConfig(1, pattern);
  if (preview.length > 30) {
    throw new BadRequestException(
      `Panjang hasil format No. RM (${preview.length} karakter) melebihi batas maksimal 30 karakter.`,
    );
  }
}

/**
 * Mengambil pola penomoran No. RM efektif untuk PasienService berdasarkan override atau setting tenant.
 */
export function extractNoRmPatternFromTenantSettings(
  rawSettings?: Record<string, unknown> | null,
  requestedFormat?: string,
): NoRmFormatPattern {
  if (requestedFormat && requestedFormat.trim() !== '') {
    const code = requestedFormat.trim().toUpperCase();
    if (
      code === 'PLAIN_8' ||
      code === 'DASH_6' ||
      code === 'PLAIN_4'
    ) {
      return NO_RM_PRESET_PATTERNS[code];
    }
    throw new BadRequestException(
      `Format No. RM "${requestedFormat}" tidak dikenali. Gunakan PLAIN_8, DASH_6, PLAIN_4, atau kosongkan untuk mengikuti setting tenant.`,
    );
  }

  return normalizeTenantSettings(rawSettings).noRm;
}
