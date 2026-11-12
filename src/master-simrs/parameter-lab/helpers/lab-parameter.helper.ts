import { BadRequestException } from '@nestjs/common';
import {
  FlagHasilLab,
  JenisKelaminRujukanLab,
  TipeHasilLab,
} from '../../constants/simrs.enum';

export interface LabRujukanCandidate {
  id?: number;
  jenisKelamin: string;
  usiaMinHari: number;
  usiaMaxHari: number;
  labelUsia?: string | null;
  nilaiMin?: string | number | null;
  nilaiMax?: string | number | null;
  kritisMin?: string | number | null;
  kritisMax?: string | number | null;
  nilaiNormalText?: string | null;
  keterangan?: string | null;
}

export interface LabHasilEvalResult {
  hasilNilai: string | null;
  hasilAngka: string | null;
  flagAbnormal: FlagHasilLab | null;
  isKritis: boolean;
}

const DEFAULT_ADULT_AGE_DAYS = 25 * 365;

const toOptionalFiniteNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

/**
 * Menghitung usia pasien dalam satuan hari pada tanggal acuan (default hari ini).
 */
export function calculateAgeInDays(
  tanggalLahir?: string | Date | null,
  tanggalRef?: string | Date | null,
): number {
  if (!tanggalLahir) return DEFAULT_ADULT_AGE_DAYS;
  const birth = new Date(tanggalLahir);
  if (Number.isNaN(birth.getTime())) return DEFAULT_ADULT_AGE_DAYS;

  const ref = tanggalRef ? new Date(tanggalRef) : new Date();
  const safeRef = Number.isNaN(ref.getTime()) ? new Date() : ref;
  const diffMs = safeRef.getTime() - birth.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Memilih aturan nilai rujukan paling spesifik untuk pasien berdasarkan jenis kelamin dan usia.
 */
export function resolveRujukanPasien<T extends LabRujukanCandidate>(
  rujukanList: T[] | undefined | null,
  jenisKelamin?: string | null,
  tanggalLahir?: string | Date | null,
  tanggalRef?: string | Date | null,
): T | null {
  if (!rujukanList || rujukanList.length === 0) return null;

  const ageDays = calculateAgeInDays(tanggalLahir, tanggalRef);
  const gender = (jenisKelamin || '').toUpperCase();

  const candidates = rujukanList.filter((item) => {
    const genderMatch =
      item.jenisKelamin === JenisKelaminRujukanLab.ALL ||
      (gender !== '' && item.jenisKelamin.toUpperCase() === gender);
    const minAge = Number(item.usiaMinHari ?? 0);
    const maxAge = Number(item.usiaMaxHari ?? 99999);
    return genderMatch && ageDays >= minAge && ageDays <= maxAge;
  });

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const aExactGender =
      gender !== '' && a.jenisKelamin.toUpperCase() === gender ? 1 : 0;
    const bExactGender =
      gender !== '' && b.jenisKelamin.toUpperCase() === gender ? 1 : 0;
    if (bExactGender !== aExactGender) {
      return bExactGender - aExactGender;
    }

    const spanA = Number(a.usiaMaxHari ?? 99999) - Number(a.usiaMinHari ?? 0);
    const spanB = Number(b.usiaMaxHari ?? 99999) - Number(b.usiaMinHari ?? 0);
    if (spanA !== spanB) return spanA - spanB;

    return Number(a.id ?? 0) - Number(b.id ?? 0);
  });

  return candidates[0] ?? null;
}

/**
 * Memformat nilai rujukan menjadi teks tampilan yang mudah dibaca petugas & pada lembar cetak hasil lab.
 */
export function formatRujukanDisplay(
  rujukan?: LabRujukanCandidate | null,
  satuan?: string | null,
): string {
  if (!rujukan) return '-';
  if (rujukan.nilaiNormalText && rujukan.nilaiNormalText.trim() !== '') {
    return rujukan.nilaiNormalText.trim();
  }

  const minVal = toOptionalFiniteNumber(rujukan.nilaiMin);
  const maxVal = toOptionalFiniteNumber(rujukan.nilaiMax);
  const unitSuffix = satuan ? ` ${satuan}` : '';

  if (minVal !== null && maxVal !== null) {
    return `${minVal} - ${maxVal}${unitSuffix}`;
  }
  if (minVal !== null) {
    return `>= ${minVal}${unitSuffix}`;
  }
  if (maxVal !== null) {
    return `<= ${maxVal}${unitSuffix}`;
  }
  return '-';
}

/**
 * Mengevaluasi input hasil parameter laboratorium terhadap tipe hasil & nilai rujukan pasien.
 */
export function evaluateHasilLab(
  rawValue: string | null | undefined,
  tipeHasil: string,
  desimal: number,
  rujukan: {
    nilaiMin?: string | number | null;
    nilaiMax?: string | number | null;
    kritisMin?: string | number | null;
    kritisMax?: string | number | null;
    nilaiNormalText?: string | null;
  },
  parameterLabel = 'Parameter',
): LabHasilEvalResult {
  if (rawValue === null || rawValue === undefined) {
    return {
      hasilNilai: null,
      hasilAngka: null,
      flagAbnormal: null,
      isKritis: false,
    };
  }

  const trimmed = String(rawValue).trim();
  if (trimmed === '') {
    return {
      hasilNilai: null,
      hasilAngka: null,
      flagAbnormal: null,
      isKritis: false,
    };
  }

  if (tipeHasil === TipeHasilLab.NUMERIC) {
    const kritisMin = toOptionalFiniteNumber(rujukan.kritisMin);
    const kritisMax = toOptionalFiniteNumber(rujukan.kritisMax);
    const nilaiMin = toOptionalFiniteNumber(rujukan.nilaiMin);
    const nilaiMax = toOptionalFiniteNumber(rujukan.nilaiMax);
    const hasNumericBounds =
      kritisMin !== null ||
      kritisMax !== null ||
      nilaiMin !== null ||
      nilaiMax !== null;

    const normalizedStr = trimmed.replace(/,/g, '.');
    const numericVal = Number(normalizedStr);

    if (Number.isFinite(numericVal)) {
      const safeDesimal = Math.max(
        0,
        Math.min(4, Math.floor(Number(desimal ?? 2))),
      );
      const roundedNum = Number(numericVal.toFixed(safeDesimal));
      const displayValue = String(roundedNum);
      const storedAngka = numericVal.toFixed(4);

      if (kritisMin !== null && numericVal < kritisMin) {
        return {
          hasilNilai: displayValue,
          hasilAngka: storedAngka,
          flagAbnormal: FlagHasilLab.CRITICAL_LOW,
          isKritis: true,
        };
      }
      if (kritisMax !== null && numericVal > kritisMax) {
        return {
          hasilNilai: displayValue,
          hasilAngka: storedAngka,
          flagAbnormal: FlagHasilLab.CRITICAL_HIGH,
          isKritis: true,
        };
      }
      if (nilaiMin !== null && numericVal < nilaiMin) {
        return {
          hasilNilai: displayValue,
          hasilAngka: storedAngka,
          flagAbnormal: FlagHasilLab.LOW,
          isKritis: false,
        };
      }
      if (nilaiMax !== null && numericVal > nilaiMax) {
        return {
          hasilNilai: displayValue,
          hasilAngka: storedAngka,
          flagAbnormal: FlagHasilLab.HIGH,
          isKritis: false,
        };
      }

      if (nilaiMin !== null || nilaiMax !== null) {
        return {
          hasilNilai: displayValue,
          hasilAngka: storedAngka,
          flagAbnormal: FlagHasilLab.NORMAL,
          isKritis: false,
        };
      }

      // Jika batas numerik tidak diatur tapi nilaiNormalText ada, izinkan evaluasi teks berikut
      if (!rujukan.nilaiNormalText?.trim()) {
        return {
          hasilNilai: displayValue,
          hasilAngka: storedAngka,
          flagAbnormal: null,
          isKritis: false,
        };
      }
    } else if (hasNumericBounds) {
      throw new BadRequestException(
        `Hasil "${parameterLabel}" harus berupa angka yang valid.`,
      );
    }
  }

  const normalText = rujukan.nilaiNormalText?.trim();
  if (!normalText) {
    return {
      hasilNilai: trimmed.slice(0, 255),
      hasilAngka: null,
      flagAbnormal: null,
      isKritis: false,
    };
  }

  const normalTokens = normalText
    .split(/[|/,]/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);

  const isMatch =
    normalTokens.includes(trimmed.toLowerCase()) ||
    normalText.toLowerCase() === trimmed.toLowerCase();

  return {
    hasilNilai: trimmed.slice(0, 255),
    hasilAngka: null,
    flagAbnormal: isMatch ? FlagHasilLab.NORMAL : FlagHasilLab.ABNORMAL,
    isKritis: false,
  };
}
