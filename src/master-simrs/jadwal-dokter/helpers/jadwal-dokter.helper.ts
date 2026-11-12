import { BadRequestException } from '@nestjs/common';
import { JadwalDokter } from '@entities/jadwal-dokter.entity';
import { HariPraktik } from '../../constants/simrs.enum';
import { formatNamaGelarDokter } from '../../helpers/master-entity.helper';

export interface HariPraktikMeta {
  urutan: number;
  kodeBpjs: number;
  jsDay: number;
  label: string;
}

export const HARI_PRAKTIK_METADATA: Record<HariPraktik, HariPraktikMeta> = {
  [HariPraktik.SENIN]: { urutan: 1, kodeBpjs: 1, jsDay: 1, label: 'Senin' },
  [HariPraktik.SELASA]: { urutan: 2, kodeBpjs: 2, jsDay: 2, label: 'Selasa' },
  [HariPraktik.RABU]: { urutan: 3, kodeBpjs: 3, jsDay: 3, label: 'Rabu' },
  [HariPraktik.KAMIS]: { urutan: 4, kodeBpjs: 4, jsDay: 4, label: 'Kamis' },
  [HariPraktik.JUMAT]: { urutan: 5, kodeBpjs: 5, jsDay: 5, label: 'Jumat' },
  [HariPraktik.SABTU]: { urutan: 6, kodeBpjs: 6, jsDay: 6, label: 'Sabtu' },
  [HariPraktik.MINGGU]: { urutan: 7, kodeBpjs: 7, jsDay: 0, label: 'Minggu' },
};

export const HARI_PRAKTIK_ORDER: HariPraktik[] = Object.values(
  HariPraktik,
).sort(
  (a, b) => HARI_PRAKTIK_METADATA[a].urutan - HARI_PRAKTIK_METADATA[b].urutan,
);

const JS_DAY_TO_HARI_PRAKTIK = new Map<number, HariPraktik>(
  HARI_PRAKTIK_ORDER.map((hari) => [HARI_PRAKTIK_METADATA[hari].jsDay, hari]),
);

const TIME_FORMAT_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_FORMAT_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Mengambil urutan numerik hari (1 = Senin .. 7 = Minggu) sesuai ISO-8601 / BPJS HFIS.
 */
export function getHariUrutan(hari: HariPraktik): number {
  return HARI_PRAKTIK_METADATA[hari].urutan;
}

/**
 * Mengonversi jam format HH:mm menjadi jumlah menit sejak 00:00.
 */
export function parseJamKeMenit(jam: string): number {
  const normalized = jam.trim().slice(0, 5);
  if (!TIME_FORMAT_REGEX.test(normalized)) {
    throw new BadRequestException(
      `Format jam "${jam}" tidak valid. Gunakan format HH:mm (00:00 - 23:59).`,
    );
  }
  const [hours, minutes] = normalized.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Mengonversi string tanggal YYYY-MM-DD menjadi enum HariPraktik secara akurat (UTC).
 */
export function resolveHariDariTanggal(tanggal: string): HariPraktik {
  const match = DATE_FORMAT_REGEX.exec(tanggal.trim());
  if (!match) {
    throw new BadRequestException(
      'Format tanggal tidak valid. Gunakan format YYYY-MM-DD.',
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utcDate = new Date(Date.UTC(year, month - 1, day));

  if (
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() !== month - 1 ||
    utcDate.getUTCDate() !== day
  ) {
    throw new BadRequestException(`Tanggal kalender "${tanggal}" tidak valid.`);
  }

  const hari = JS_DAY_TO_HARI_PRAKTIK.get(utcDate.getUTCDay());
  if (!hari) {
    throw new BadRequestException(
      `Gagal memetakan hari untuk tanggal "${tanggal}".`,
    );
  }
  return hari;
}

/**
 * Memvalidasi jam praktik, durasi per pasien, serta konsistensi kuota JKN/Non-JKN/Total.
 */
export function resolveAndValidateJadwalMetrics(input: {
  jamMulai: string;
  jamSelesai: string;
  durasiPerPasien?: number | null;
  kuotaJkn?: number;
  kuotaNonJkn?: number;
  kuotaTotal?: number;
  autoSumEmptyTotal?: boolean;
}): {
  jamMulai: string;
  jamSelesai: string;
  durasiPerPasien: number | null;
  kuotaJkn: number;
  kuotaNonJkn: number;
  kuotaTotal: number;
} {
  const jamMulai = input.jamMulai.trim().slice(0, 5);
  const jamSelesai = input.jamSelesai.trim().slice(0, 5);

  const mulaiMenit = parseJamKeMenit(jamMulai);
  const selesaiMenit = parseJamKeMenit(jamSelesai);
  const durasiSesiMenit = selesaiMenit - mulaiMenit;

  if (durasiSesiMenit <= 0) {
    throw new BadRequestException(
      'Jam selesai praktik harus lebih besar daripada jam mulai praktik.',
    );
  }

  const durasiPerPasien = input.durasiPerPasien ?? null;
  if (durasiPerPasien !== null) {
    if (durasiPerPasien < 1) {
      throw new BadRequestException(
        'Durasi layanan per pasien minimal 1 menit.',
      );
    }
    if (durasiPerPasien > durasiSesiMenit) {
      throw new BadRequestException(
        `Durasi per pasien (${durasiPerPasien} menit) tidak boleh melebihi durasi sesi praktik (${durasiSesiMenit} menit).`,
      );
    }
  }

  const kuotaJkn = input.kuotaJkn ?? 0;
  const kuotaNonJkn = input.kuotaNonJkn ?? 0;
  if (kuotaJkn < 0 || kuotaNonJkn < 0) {
    throw new BadRequestException(
      'Kuota JKN dan Kuota Non-JKN tidak boleh bernilai negatif.',
    );
  }

  const jumlahSubtotal = kuotaJkn + kuotaNonJkn;
  let kuotaTotal = input.kuotaTotal;

  if (kuotaTotal === undefined) {
    kuotaTotal = jumlahSubtotal;
  } else if (
    kuotaTotal === 0 &&
    input.autoSumEmptyTotal &&
    jumlahSubtotal > 0
  ) {
    kuotaTotal = jumlahSubtotal;
  }

  if (kuotaTotal < 0) {
    throw new BadRequestException('Kuota total tidak boleh bernilai negatif.');
  }

  if (jumlahSubtotal > kuotaTotal) {
    throw new BadRequestException(
      `Jumlah kuota JKN (${kuotaJkn}) + Non-JKN (${kuotaNonJkn}) tidak boleh melebihi kuota total (${kuotaTotal}).`,
    );
  }

  return {
    jamMulai,
    jamSelesai,
    durasiPerPasien,
    kuotaJkn,
    kuotaNonJkn,
    kuotaTotal,
  };
}

/**
 * Menambahkan properti tampilan dokter (namaTampilan) dan metadata hari pada item jadwal dokter.
 */
export function enrichJadwalDokterItem(row: JadwalDokter) {
  const meta = HARI_PRAKTIK_METADATA[row.hari as HariPraktik] ?? undefined;
  let estimasiSlot: number | null = null;

  if (
    row.durasiPerPasien &&
    row.durasiPerPasien > 0 &&
    row.jamMulai &&
    row.jamSelesai
  ) {
    const durasi =
      parseJamKeMenit(row.jamSelesai) - parseJamKeMenit(row.jamMulai);
    if (durasi > 0) {
      estimasiSlot = Math.floor(durasi / row.durasiPerPasien);
    }
  }

  return {
    ...row,
    hariLabel: meta?.label ?? row.hari,
    hariUrutan: meta?.urutan ?? null,
    kodeHariBpjs: meta?.kodeBpjs ?? null,
    estimasiSlot,
    dokter: row.dokter
      ? {
          ...row.dokter,
          namaTampilan: formatNamaGelarDokter(
            row.dokter.gelarDepan,
            row.dokter.penduduk?.namaLengkap,
            row.dokter.gelarBelakang,
          ),
        }
      : row.dokter,
  };
}
