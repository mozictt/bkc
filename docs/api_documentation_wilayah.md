# Dokumentasi API - Wilayah Administratif Indonesia (Autocomplete)

Dokumen ini berisi detail rute API, parameter query, dan struktur respons untuk modul Wilayah Administratif Indonesia (Provinsi, Kabupaten, Kecamatan, Kelurahan). 

Semua rute di bawah ini bersifat publik (`@Public()`) karena sering digunakan pada form pendaftaran (sebelum user melakukan login/autentikasi).

**Base URL**: `http://localhost:3000` (Sesuaikan dengan *environment* Anda)
**Authentication**: Tidak memerlukan token otorisasi (Public)

---

## 1. Cari Provinsi (Autocomplete)
Digunakan untuk memuat daftar provinsi berdasarkan kata kunci pencarian.

*   **Endpoint**: `GET /wilayah/provinsi`
*   **Query Parameters**:
    - `search` (string, opsional): Kata kunci pencarian nama provinsi.
    - `limit` (number, opsional, default: 10): Jumlah hasil yang dikembalikan.

**Respons Sukses (200 OK):**
```json
[
  {
    "id": "32",
    "nama": "JAWA BARAT"
  },
  {
    "id": "31",
    "nama": "DKI JAKARTA"
  }
]
```

---

## 2. Cari Kabupaten / Kota (Autocomplete)
Digunakan untuk memuat daftar kabupaten/kota. Dapat difilter berdasarkan Provinsi induknya.

*   **Endpoint**: `GET /wilayah/kabupaten`
*   **Query Parameters**:
    - `search` (string, opsional): Kata kunci pencarian nama kabupaten/kota.
    - `provinsiId` (string, opsional, panjang 2 digit): ID/Kode Provinsi induk (contoh: `32` untuk Jawa Barat).
    - `limit` (number, opsional, default: 10): Jumlah hasil.

**Respons Sukses (200 OK):**
```json
[
  {
    "id": "32.73",
    "nama": "KOTA BANDUNG",
    "provinsiId": "32"
  }
]
```

---

## 3. Cari Kecamatan (Autocomplete)
Digunakan untuk memuat daftar kecamatan. Dapat difilter berdasarkan Kabupaten induknya.

*   **Endpoint**: `GET /wilayah/kecamatan`
*   **Query Parameters**:
    - `search` (string, opsional): Kata kunci pencarian nama kecamatan.
    - `kabupatenId` (string, opsional, panjang 5 digit): ID/Kode Kabupaten induk (contoh: `32.73` untuk Kota Bandung).
    - `limit` (number, opsional, default: 10): Jumlah hasil.

**Respons Sukses (200 OK):**
```json
[
  {
    "id": "32.73.08",
    "nama": "COBLONG",
    "kabupatenId": "32.73"
  }
]
```

---

## 4. Cari Kelurahan / Desa (Autocomplete)
Digunakan untuk memuat daftar kelurahan/desa. Dapat difilter berdasarkan Kecamatan induknya.

*   **Endpoint**: `GET /wilayah/kelurahan`
*   **Query Parameters**:
    - `search` (string, opsional): Kata kunci pencarian nama kelurahan/desa.
    - `kecamatanId` (string, opsional, panjang 8 digit): ID/Kode Kecamatan induk (contoh: `32.73.08` untuk Coblong).
    - `limit` (number, opsional, default: 10): Jumlah hasil.

**Respons Sukses (200 OK):**
```json
[
  {
    "id": "32.73.08.1001",
    "nama": "DAGO",
    "kodePos": "40135",
    "kecamatanId": "32.73.08"
  }
]
```

---

## 5. Pencarian Global (Single Autocomplete)
Mencari data kelurahan langsung beserta seluruh informasi kecamatan, kabupaten, dan provinsi dalam satu kali ketik. Metode ini dioptimalkan dengan *Single Join Query* untuk mencegah masalah query N+1.

*   **Endpoint**: `GET /wilayah/search`
*   **Query Parameters**:
    - `q` (string, wajib): Kata kunci pencarian (nama Kelurahan, Kecamatan, atau Kabupaten).
    - `limit` (number, opsional, default: 10): Jumlah hasil yang dikembalikan.

**Respons Sukses (200 OK):**
```json
[
  {
    "id": "32.73.08.1001",
    "kelurahan": "DAGO",
    "kecamatan": "COBLONG",
    "kabupaten": "KOTA BANDUNG",
    "provinsi": "JAWA BARAT",
    "kodePos": "40135",
    "label": "DAGO, COBLONG, KOTA BANDUNG, JAWA BARAT"
  }
]
```
*(Catatan: Kolom `label` dapat langsung dipetakan ke dalam elemen autocomplete UI frontend).*

---

## 6. Fitur Pendukung & Optimasi
1.  **Redis Caching**: Hasil query disimpan secara otomatis di Redis selama **1 Hari (86400 detik)** menggunakan kunci berformat `wilayah:*` untuk menjamin waktu respons di bawah 20ms.
2.  **SQL Injection Protection**: Semua query input dibersihkan secara otomatis menggunakan parameter terikat (Prepared Statements) di TypeORM Query Builder.
3.  **Trigram Indexing (Rekomendasi)**: Sangat disarankan menambahkan indeks trigram pada tabel kelurahan di database produksi jika volume pencarian tinggi:
    ```sql
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
    CREATE INDEX idx_kelurahan_nama_trgm ON kelurahan USING gin (nama gin_trgm_ops);
    ```
