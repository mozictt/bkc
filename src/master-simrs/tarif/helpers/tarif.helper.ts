import { BadRequestException } from '@nestjs/common';
import type { TarifLayanan } from '@entities/tarif-layanan.entity';
import { JenisTarif } from '../../constants/simrs.enum';

export interface TarifKomponenInput {
  jasaSarana?: number;
  bhp?: number;
  jasaDokter?: number;
  jasaNakes?: number;
}

export interface CalculatedTarifNominal {
  jasaSarana: string;
  bhp: string;
  jasaDokter: string;
  jasaNakes: string;
  totalTarif: string;
  numbers: {
    jasaSarana: number;
    bhp: number;
    jasaDokter: number;
    jasaNakes: number;
    totalTarif: number;
  };
}

export interface TarifResolveContext {
  unitId?: number | null;
  penjaminId?: number | null;
  kelasId?: number | null;
}

const MAX_DATE_SENTINEL = '9999-12-31';

const toNonNegativeSen = (value: unknown, fieldLabel: string): number => {
  if (value === undefined || value === null || value === '') return 0;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    throw new BadRequestException(`${fieldLabel} tidak boleh negatif.`);
  }
  return Math.round(num * 100);
};

const senToNumericString = (sen: number): string => (sen / 100).toFixed(2);
const senToNumber = (sen: number): number => Number((sen / 100).toFixed(2));

/**
 * Menghitung nominal komponen tarif dan totalTarif secara deterministik dengan aritmatika sen.
 */
export function calculateTarifNominal(
  input: TarifKomponenInput,
): CalculatedTarifNominal {
  const saranaSen = toNonNegativeSen(input.jasaSarana, 'Jasa Sarana');
  const bhpSen = toNonNegativeSen(input.bhp, 'BHP');
  const dokterSen = toNonNegativeSen(input.jasaDokter, 'Jasa Dokter');
  const nakesSen = toNonNegativeSen(input.jasaNakes, 'Jasa Nakes');
  const totalSen = saranaSen + bhpSen + dokterSen + nakesSen;

  return {
    jasaSarana: senToNumericString(saranaSen),
    bhp: senToNumericString(bhpSen),
    jasaDokter: senToNumericString(dokterSen),
    jasaNakes: senToNumericString(nakesSen),
    totalTarif: senToNumericString(totalSen),
    numbers: {
      jasaSarana: senToNumber(saranaSen),
      bhp: senToNumber(bhpSen),
      jasaDokter: senToNumber(dokterSen),
      jasaNakes: senToNumber(nakesSen),
      totalTarif: senToNumber(totalSen),
    },
  };
}

export function parseNumericMoney(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const num = Number(value);
  return Number.isFinite(num) ? Number(num.toFixed(2)) : 0;
}

/**
 * Menormalkan metadata opsional khusus untuk Laboratorium dan Radiologi agar aman disimpan ke JSONB.
 */
export function normalizeAtributKhusus(
  jenisTarif: string,
  raw?: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  const normalized: Record<string, unknown> = {};
  const trimOptional = (val: unknown, maxLen: number): string | undefined => {
    if (typeof val !== 'string') return undefined;
    const t = val.trim();
    return t === '' ? undefined : t.slice(0, maxLen);
  };

  if (jenisTarif === JenisTarif.LABORATORIUM) {
    const spesimen = trimOptional(raw.spesimen, 100);
    const metode = trimOptional(raw.metode, 100);
    if (spesimen) normalized.spesimen = spesimen;
    if (metode) normalized.metode = metode;
    if (typeof raw.butuhPuasa === 'boolean') {
      normalized.butuhPuasa = raw.butuhPuasa;
    }
    if (raw.estimasiHasilJam !== undefined && raw.estimasiHasilJam !== null) {
      const hours = Number(raw.estimasiHasilJam);
      if (Number.isFinite(hours) && hours >= 0 && hours <= 720) {
        normalized.estimasiHasilJam = Math.round(hours);
      }
    }
  } else if (jenisTarif === JenisTarif.RADIOLOGI) {
    const modalitas = trimOptional(raw.modalitas, 60);
    const proyeksi = trimOptional(raw.proyeksi, 120);
    if (modalitas) normalized.modalitas = modalitas;
    if (proyeksi) normalized.proyeksi = proyeksi;
    if (typeof raw.butuhKontras === 'boolean') {
      normalized.butuhKontras = raw.butuhKontras;
    }
  } else {
    const catatanTeknis = trimOptional(raw.catatanTeknis, 250);
    if (catatanTeknis) normalized.catatanTeknis = catatanTeknis;
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
}

/**
 * Mengembalikan tanggal hari ini dalam format YYYY-MM-DD.
 */
export function getTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Memvalidasi rentang tanggal efektif aturan tarif.
 */
export function validateEffectiveDateRange(
  berlakuMulai?: string | null,
  berlakuSampai?: string | null,
): { berlakuMulai: string; berlakuSampai: string | null } {
  const start =
    berlakuMulai && berlakuMulai.trim() !== ''
      ? berlakuMulai.trim().slice(0, 10)
      : getTodayIsoDate();

  const end =
    berlakuSampai && berlakuSampai.trim() !== ''
      ? berlakuSampai.trim().slice(0, 10)
      : null;

  if (end && end < start) {
    throw new BadRequestException(
      'Tanggal berlaku sampai tidak boleh lebih awal dari tanggal berlaku mulai.',
    );
  }

  return { berlakuMulai: start, berlakuSampai: end };
}

/**
 * Mengecek apakah dua rentang tanggal aktif [startA, endA] dan [startB, endB] saling beririsan.
 */
export function isDateRangeOverlap(
  startA: string,
  endA: string | null,
  startB: string,
  endB: string | null,
): boolean {
  const effEndA = endA ?? MAX_DATE_SENTINEL;
  const effEndB = endB ?? MAX_DATE_SENTINEL;
  return startA <= effEndB && startB <= effEndA;
}

/**
 * Menghitung skor spesifisitas rule sesuai prioritas Unit -> Penjamin -> Kelas.
 * Skor: Unit (+4), Penjamin (+2), Kelas (+1) sehingga urutan ranking:
 * 7: Unit + Penjamin + Kelas
 * 6: Unit + Penjamin
 * 5: Unit + Kelas
 * 4: Unit Spesifik
 * 3: Penjamin + Kelas
 * 2: Penjamin Spesifik
 * 1: Kelas Spesifik
 * 0: Default Global (Semua Unit, Penjamin, & Kelas)
 */
export function getRuleSpecificityScore(rule: {
  unitId: number | null;
  penjaminId: number | null;
  kelasId: number | null;
}): number {
  return (
    (rule.unitId !== null ? 4 : 0) +
    (rule.penjaminId !== null ? 2 : 0) +
    (rule.kelasId !== null ? 1 : 0)
  );
}

const SCORE_LABEL_MAP: Record<number, string> = {
  7: 'Unit + Penjamin + Kelas (Spesifik Penuh)',
  6: 'Unit + Penjamin',
  5: 'Unit + Kelas',
  4: 'Unit Spesifik',
  3: 'Penjamin + Kelas',
  2: 'Penjamin Spesifik',
  1: 'Kelas Spesifik',
  0: 'Tarif Dasar (Berlaku Umum)',
};

export function getSpecificityLabel(score: number): string {
  return SCORE_LABEL_MAP[score] ?? 'Tarif Dasar';
}

export function isRuleCompatibleWithContext(
  rule: {
    unitId: number | null;
    penjaminId: number | null;
    kelasId: number | null;
  },
  context: TarifResolveContext,
): boolean {
  if (rule.unitId !== null && rule.unitId !== (context.unitId ?? null)) {
    return false;
  }
  if (
    rule.penjaminId !== null &&
    rule.penjaminId !== (context.penjaminId ?? null)
  ) {
    return false;
  }
  if (rule.kelasId !== null && rule.kelasId !== (context.kelasId ?? null)) {
    return false;
  }
  return true;
}

export function formatTarifLayananItem(row: TarifLayanan) {
  const score = getRuleSpecificityScore(row);
  return {
    id: row.id,
    tindakanId: row.tindakanId,
    unitId: row.unitId,
    penjaminId: row.penjaminId,
    kelasId: row.kelasId,
    unit: row.unit
      ? {
          id: row.unit.id,
          kode: row.unit.kode,
          nama: row.unit.nama,
          jenisUnit: row.unit.jenisUnit,
        }
      : null,
    penjamin: row.penjamin
      ? {
          id: row.penjamin.id,
          kode: row.penjamin.kode,
          nama: row.penjamin.nama,
          jenisPenjamin: row.penjamin.jenisPenjamin,
        }
      : null,
    kelas: row.kelas
      ? {
          id: row.kelas.id,
          kode: row.kelas.kode,
          nama: row.kelas.nama,
          urutan: row.kelas.urutan,
        }
      : null,
    jasaSarana: parseNumericMoney(row.jasaSarana),
    bhp: parseNumericMoney(row.bhp),
    jasaDokter: parseNumericMoney(row.jasaDokter),
    jasaNakes: parseNumericMoney(row.jasaNakes),
    totalTarif: parseNumericMoney(row.totalTarif),
    berlakuMulai: row.berlakuMulai,
    berlakuSampai: row.berlakuSampai,
    keterangan: row.keterangan,
    status: row.status,
    specificityScore: score,
    specificityLabel: getSpecificityLabel(score),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Memilih aturan tarif paling tepat berdasarkan prioritas Unit -> Penjamin -> Kelas.
 */
export function resolveBestTarifRule(
  candidates: TarifLayanan[],
  context: TarifResolveContext,
) {
  const compatible = candidates
    .filter((row) => isRuleCompatibleWithContext(row, context))
    .map(formatTarifLayananItem)
    .sort((a, b) => {
      if (b.specificityScore !== a.specificityScore) {
        return b.specificityScore - a.specificityScore;
      }
      if (b.berlakuMulai !== a.berlakuMulai) {
        return b.berlakuMulai.localeCompare(a.berlakuMulai);
      }
      return b.id - a.id;
    });

  const best = compatible[0] ?? null;

  return {
    found: Boolean(best),
    rule: best,
    skorKecocokan: best ? best.specificityScore : null,
    keteranganKecocokan: best
      ? best.specificityLabel
      : 'Belum ada aturan tarif aktif yang cocok untuk kombinasi ini.',
    rincian: best
      ? {
          jasaSarana: best.jasaSarana,
          bhp: best.bhp,
          jasaDokter: best.jasaDokter,
          jasaNakes: best.jasaNakes,
          totalTarif: best.totalTarif,
        }
      : null,
    kandidatTerurut: compatible,
  };
}
