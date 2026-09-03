import { DataSource } from 'typeorm';
import { Provinsi } from '../../entities/provinsi.entity';
import { Kabupaten } from '../../entities/kabupaten.entity';
import { Kecamatan } from '../../entities/kecamatan.entity';
import { Kelurahan } from '../../entities/kelurahan.entity';

// Parser SQL Value line by line secara cepat dan aman
function parseSqlLine(line: string): { code: string; name: string } | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('(')) return null;
  
  const firstComma = trimmed.indexOf(',');
  if (firstComma === -1) return null;
  
  const code = trimmed.substring(1, firstComma).replace(/'/g, '').trim();
  
  let namePart = trimmed.substring(firstComma + 1).trim();
  if (namePart.endsWith(',') || namePart.endsWith(';')) {
    namePart = namePart.slice(0, -1);
  }
  if (namePart.endsWith(')')) {
    namePart = namePart.slice(0, -1);
  }
  namePart = namePart.trim();
  if (namePart.startsWith("'") && namePart.endsWith("'")) {
    namePart = namePart.slice(1, -1);
  }
  // Unescape double single quote SQL ('' -> ')
  const name = namePart.replace(/''/g, "'");
  
  return { code, name };
}

export async function runWilayahSeed(dataSource: DataSource) {
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();

  try {
    console.log('🧹 Menghapus data wilayah lama...');
    await queryRunner.query('DELETE FROM kelurahan;');
    await queryRunner.query('DELETE FROM kecamatan;');
    await queryRunner.query('DELETE FROM kabupaten;');
    await queryRunner.query('DELETE FROM provinsi;');

    // 1. DOWNLOAD DATA MAPPING KODE POS
    console.log('📥 Mengunduh data mapping Kode Pos...');
    const kodeposRes = await fetch('https://raw.githubusercontent.com/cahyadsn/wilayah_kodepos/master/json/wilayah_kodepos.json');
    const kodeposMap = await kodeposRes.json() as Record<string, string>;

    // 2. DOWNLOAD DATA WILAYAH KEMENDAGRI
    console.log('📥 Mengunduh data Wilayah Kemendagri (sangat besar)...');
    const wilayahRes = await fetch('https://raw.githubusercontent.com/cahyadsn/wilayah/master/db/wilayah.sql');
    const wilayahText = await wilayahRes.text();
    const lines = wilayahText.split('\n');

    const provEntities: { id: string; nama: string }[] = [];
    const kabEntities: { id: string; provinsiId: string; nama: string }[] = [];
    const kecEntities: { id: string; kabupatenId: string; nama: string }[] = [];
    const kelEntities: { id: string; kecamatanId: string; nama: string; kodePos: string | undefined }[] = [];

    const seenProv = new Set<string>();
    const seenKab = new Set<string>();
    const seenKec = new Set<string>();
    const seenKel = new Set<string>();

    console.log('⚙️ Memproses data wilayah dan menggabungkan Kode Pos...');
    for (const line of lines) {
      const parsed = parseSqlLine(line);
      if (!parsed) continue;

      const { code, name } = parsed;

      if (code.length === 2) {
        if (!seenProv.has(code)) {
          seenProv.add(code);
          provEntities.push({ id: code, nama: name });
        }
      } else if (code.length === 5) {
        if (!seenKab.has(code)) {
          seenKab.add(code);
          const provinsiId = code.substring(0, 2);
          kabEntities.push({ id: code, provinsiId, nama: name });
        }
      } else if (code.length === 8) {
        if (!seenKec.has(code)) {
          seenKec.add(code);
          const kabupatenId = code.substring(0, 5);
          kecEntities.push({ id: code, kabupatenId, nama: name });
        }
      } else if (code.length === 13) {
        if (!seenKel.has(code)) {
          seenKel.add(code);
          const kecamatanId = code.substring(0, 8);
          const kodePos = kodeposMap[code] || undefined;
          kelEntities.push({ id: code, kecamatanId, nama: name, kodePos });
        }
      }
    }

    // 3. INSERT BATCH KE DATABASE
    console.log(`🌱 Memasukkan ${provEntities.length} data Provinsi...`);
    await queryRunner.manager.insert(Provinsi, provEntities);

    console.log(`🌱 Memasukkan ${kabEntities.length} data Kabupaten...`);
    for (let i = 0; i < kabEntities.length; i += 500) {
      const batch = kabEntities.slice(i, i + 500);
      await queryRunner.manager.insert(Kabupaten, batch);
    }

    console.log(`🌱 Memasukkan ${kecEntities.length} data Kecamatan...`);
    for (let i = 0; i < kecEntities.length; i += 1000) {
      const batch = kecEntities.slice(i, i + 1000);
      await queryRunner.manager.insert(Kecamatan, batch);
    }

    console.log(`🌱 Memasukkan ${kelEntities.length} data Kelurahan beserta Kode Pos...`);
    for (let i = 0; i < kelEntities.length; i += 1000) {
      const batch = kelEntities.slice(i, i + 1000);
      await queryRunner.manager.insert(Kelurahan, batch);
      if (i % 10000 === 0) {
        console.log(`... sudah memasukkan ${i} kelurahan`);
      }
    }

    console.log('✅ Seeding data wilayah dan kode pos selesai dengan sukses!');
  } catch (error) {
    console.error('❌ Gagal melakukan seeding wilayah:', error);
    throw error;
  } finally {
    await queryRunner.release();
  }
}
