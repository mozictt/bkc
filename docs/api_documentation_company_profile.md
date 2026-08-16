# Dokumentasi API — Company Profile (Profil Perusahaan)

Dokumen ini berisi detail rute API, *request payload*, dan struktur respons untuk modul **Company Profile**.
Semua rute dilindungi oleh `JwtAuthGuard` dan `PermissionGuard`. Pastikan menyertakan *header* otorisasi pada setiap *request*.

**Base URL**: `http://localhost:4000` (Sesuaikan dengan *environment* Anda)  
**Authentication**: `Authorization: Bearer <token>`  
**Swagger UI**: `http://localhost:4000/api/docs` → Bagian **Company Profile**

---

## Daftar Endpoint

| Method | Endpoint | Permission | Deskripsi |
| :--- | :--- | :--- | :--- |
| `GET` | `/company-profile` | `CompanyProfile.view` | Ambil profil perusahaan tenant aktif |
| `POST` | `/company-profile` | `CompanyProfile.create` | Buat profil perusahaan baru |
| `PUT` | `/company-profile/:id` | `CompanyProfile.update` | Update data profil |
| `POST` | `/company-profile/:id/logo` | `CompanyProfile.update` | Upload / ganti logo |
| `DELETE` | `/company-profile/:id/logo` | `CompanyProfile.update` | Hapus logo |
| `DELETE` | `/company-profile/:id` | `CompanyProfile.delete` | Soft delete profil |

---

## Struktur Data (Entity)

Tabel `company_profiles` di database memiliki field-field berikut:

### Identitas Perusahaan
| Field | Tipe DB | Wajib | Keterangan |
| :--- | :--- | :---: | :--- |
| `id` | `integer` | — | Primary Key (auto-increment) |
| `name` | `varchar(255)` | ✅ | Nama lengkap perusahaan |
| `short_name` | `varchar(100)` | ❌ | Nama singkat / akronim |
| `description` | `text` | ❌ | Deskripsi singkat perusahaan |

### Kontak
| Field | Tipe DB | Wajib | Keterangan |
| :--- | :--- | :---: | :--- |
| `email` | `varchar(255)` | ✅ | Email resmi perusahaan |
| `phone` | `varchar(30)` | ✅ | Nomor telepon |
| `fax` | `varchar(30)` | ❌ | Nomor fax |
| `website` | `varchar(255)` | ❌ | URL website (harus valid) |

### Alamat
| Field | Tipe DB | Wajib | Keterangan |
| :--- | :--- | :---: | :--- |
| `address` | `text` | ✅ | Alamat lengkap |
| `city` | `varchar(100)` | ❌ | Kota |
| `province` | `varchar(100)` | ❌ | Provinsi |
| `postal_code` | `varchar(10)` | ❌ | Kode pos |
| `country` | `varchar(100)` | ❌ | Negara |

### Legal & Bisnis
| Field | Tipe DB | Wajib | Keterangan |
| :--- | :--- | :---: | :--- |
| `npwp` | `varchar(50)` | ❌ | Nomor NPWP |
| `nib` | `varchar(50)` | ❌ | Nomor Induk Berusaha |
| `founded_at` | `date` | ❌ | Tanggal berdiri (YYYY-MM-DD) |

### Branding
| Field | Tipe DB | Wajib | Keterangan |
| :--- | :--- | :---: | :--- |
| `logo_path` | `varchar(500)` | ❌ | URL akses logo (cth: `/company-profile/logo/logo-xxx.png`) |
| `logo_filename` | `varchar(100)` | ❌ | Nama file logo |

### Sosial Media
| Field | Tipe DB | Wajib | Keterangan |
| :--- | :--- | :---: | :--- |
| `instagram` | `varchar(255)` | ❌ | URL Instagram (harus valid) |
| `facebook` | `varchar(255)` | ❌ | URL Facebook (harus valid) |
| `twitter` | `varchar(255)` | ❌ | URL Twitter/X (harus valid) |
| `linkedin` | `varchar(255)` | ❌ | URL LinkedIn (harus valid) |

### Field Multi-Tenancy (Otomatis)
| Field | Keterangan |
| :--- | :--- |
| `tenant_id` | UUID tenant pemilik data (diisi otomatis dari JWT) |
| `created_at` | Waktu data dibuat |
| `updated_at` | Waktu data terakhir diubah |
| `deleted_at` | Waktu soft delete (null = aktif) |

---

## Detail Endpoint

---

### 1. GET `/company-profile` — Ambil Profil

Mengambil profil perusahaan milik tenant yang sedang aktif berdasarkan JWT.

- **Permission**: `CompanyProfile.view`
- **Content-Type**: —

**Contoh Respons Sukses (200 OK):**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": 1,
    "name": "PT. Maju Bersama Teknologi",
    "shortName": "MBT",
    "description": "Perusahaan teknologi inovatif sejak 2010.",
    "email": "info@mbt.co.id",
    "phone": "021-12345678",
    "fax": "021-87654321",
    "website": "https://mbt.co.id",
    "address": "Jl. Sudirman No. 99, Kec. Tanah Abang",
    "city": "Jakarta Pusat",
    "province": "DKI Jakarta",
    "postalCode": "10220",
    "country": "Indonesia",
    "npwp": "01.234.567.8-901.000",
    "nib": "1234567890123",
    "foundedAt": "2010-01-15",
    "logoPath": "/company-profile/logo/logo-1234567890-unique.png",
    "logoFilename": "logo-1234567890-unique.png",
    "instagram": "https://instagram.com/mbt",
    "facebook": "https://facebook.com/mbt",
    "twitter": "https://twitter.com/mbt",
    "linkedin": "https://linkedin.com/company/mbt",
    "tenantId": "00000000-0000-0000-0000-000000000001",
    "createdAt": "2026-01-15T08:00:00.000Z",
    "updatedAt": "2026-08-13T06:00:00.000Z",
    "deletedAt": null
  }
}
```

**Respons Error:**
| Status | Keterangan |
| :--- | :--- |
| `401` | Token tidak valid atau expired |
| `403` | Tidak memiliki permission `CompanyProfile.view` |
| `404` | Profil perusahaan belum dibuat |

---

### 2. POST `/company-profile` — Buat Profil Baru

Membuat profil perusahaan baru. **Hanya boleh ada satu profil per tenant.**

- **Permission**: `CompanyProfile.create`
- **Content-Type**: `multipart/form-data`

**Request Body (Form Data):**
| Field | Tipe | Wajib | Keterangan |
| :--- | :--- | :---: | :--- |
| `name` | `string` | ✅ | Nama lengkap perusahaan (maks 255 karakter) |
| `email` | `string` | ✅ | Format email valid |
| `phone` | `string` | ✅ | Nomor telepon (maks 30 karakter) |
| `address` | `string` | ✅ | Alamat lengkap |
| `shortName` | `string` | ❌ | Nama singkat (maks 100 karakter) |
| `description` | `string` | ❌ | Deskripsi perusahaan |
| `fax` | `string` | ❌ | Nomor fax |
| `website` | `string` | ❌ | URL website valid |
| `city` | `string` | ❌ | Kota |
| `province` | `string` | ❌ | Provinsi |
| `postalCode` | `string` | ❌ | Kode pos (maks 10 karakter) |
| `country` | `string` | ❌ | Negara |
| `npwp` | `string` | ❌ | NPWP (maks 50 karakter) |
| `nib` | `string` | ❌ | NIB (maks 50 karakter) |
| `foundedAt` | `string` | ❌ | Format `YYYY-MM-DD` |
| `instagram` | `string` | ❌ | URL Instagram valid |
| `facebook` | `string` | ❌ | URL Facebook valid |
| `twitter` | `string` | ❌ | URL Twitter valid |
| `linkedin` | `string` | ❌ | URL LinkedIn valid |
| `logo` | `File` | ❌ | Gambar logo (JPG/PNG/WEBP/SVG, maks 5MB) |

**Contoh Respons Sukses (201 Created):**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": 1,
    "name": "PT. Maju Bersama Teknologi",
    "email": "info@mbt.co.id",
    "phone": "021-12345678",
    "address": "Jl. Sudirman No. 99",
    "tenantId": "00000000-0000-0000-0000-000000000001",
    "createdAt": "2026-08-13T06:00:00.000Z",
    "updatedAt": "2026-08-13T06:00:00.000Z",
    "deletedAt": null
  }
}
```

**Respons Error:**
| Status | Keterangan |
| :--- | :--- |
| `400` | Validasi gagal (field wajib kosong / format tidak valid) |
| `401` | Token tidak valid |
| `403` | Tidak memiliki permission `CompanyProfile.create` |
| `409` | Profil perusahaan sudah ada untuk tenant ini |

---

### 3. PUT `/company-profile/:id` — Update Profil

Memperbarui data profil perusahaan. Semua field bersifat opsional (partial update).

- **Permission**: `CompanyProfile.update`
- **Content-Type**: `multipart/form-data`
- **Parameter URL**: `id` (ID profil perusahaan)

**Request Body**: Sama seperti POST, namun semua field opsional. Kirim hanya field yang ingin diubah.

**Contoh (hanya update nomor telepon dan kota):**
```
PUT /company-profile/1
Content-Type: multipart/form-data

phone = 021-99999999
city  = Bandung
```

**Respons Sukses (200 OK):**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": 1,
    "phone": "021-99999999",
    "city": "Bandung",
    "updatedAt": "2026-08-13T07:00:00.000Z"
  }
}
```

**Respons Error:**
| Status | Keterangan |
| :--- | :--- |
| `400` | Format UUID tidak valid / validasi field gagal |
| `401` | Token tidak valid |
| `403` | Tidak memiliki permission atau data bukan milik tenant |
| `404` | Profil tidak ditemukan |

---

### 4. POST `/company-profile/:id/logo` — Upload / Ganti Logo

Mengunggah logo baru atau mengganti logo lama. **Logo lama dihapus otomatis dari storage.**

- **Permission**: `CompanyProfile.update`
- **Content-Type**: `multipart/form-data`
- **Parameter URL**: `id` (ID profil perusahaan)

**Request Body (Form Data):**
| Field | Tipe | Wajib | Keterangan |
| :--- | :--- | :---: | :--- |
| `logo` | `File` | ✅ | Gambar logo (JPG/PNG/WEBP/SVG, **maks 5MB**) |

**Contoh Respons Sukses (200 OK):**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": 1,
    "logoPath": "/company-profile/logo/logo-1755065234567-unique.png",
    "logoFilename": "logo-1755065234567-unique.png",
    "updatedAt": "2026-08-13T07:30:00.000Z"
  }
}
```

**Respons Error:**
| Status | Keterangan |
| :--- | :--- |
| `400` | File logo tidak dikirim / tipe file tidak didukung |
| `404` | Profil tidak ditemukan |

> **Format yang didukung**: `.jpg`, `.jpeg`, `.png`, `.webp`, `.svg` — ukuran maksimum **5MB**.

---

### 5. DELETE `/company-profile/:id/logo` — Hapus Logo

Menghapus file logo dari storage server dan mengosongkan field `logoPath` & `logoFilename`.

- **Permission**: `CompanyProfile.update`
- **Parameter URL**: `id` (ID profil perusahaan)

**Respons Sukses (200 OK):**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": 1,
    "logoPath": null,
    "logoFilename": null,
    "updatedAt": "2026-08-13T07:45:00.000Z"
  }
}
```

**Respons Error:**
| Status | Keterangan |
| :--- | :--- |
| `404` | Profil tidak ditemukan atau profil belum memiliki logo |

---

### 6. DELETE `/company-profile/:id` — Hapus Profil (Soft Delete)

Melakukan *soft delete* pada profil perusahaan. Data **tidak dihapus permanen** — kolom `deleted_at` diisi timestamp penghapusan.

- **Permission**: `CompanyProfile.delete`
- **Parameter URL**: `id` (ID profil perusahaan)

**Respons Sukses (200 OK):**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "message": "Profil perusahaan berhasil dihapus"
  }
}
```

**Respons Error:**
| Status | Keterangan |
| :--- | :--- |
| `404` | Profil tidak ditemukan atau sudah dihapus sebelumnya |

> **Catatan Soft Delete:** Data yang di-soft delete tidak muncul di `GET /company-profile`, namun masih tersimpan di database dengan nilai `deleted_at` terisi.

---

## Alur Integrasi yang Direkomendasikan

```
1. Buat profil baru
   POST /company-profile
   → Simpan id dari respons

2. Upload logo (opsional)
   POST /company-profile/{id}/logo
   Body: multipart/form-data, field: logo (file)

3. Tampilkan profil
   GET /company-profile

4. Update data
   PUT /company-profile/{id}
   → Kirim field yang berubah saja

5. Ganti logo
   POST /company-profile/{id}/logo
   → Logo lama otomatis terhapus

6. Hapus logo saja
   DELETE /company-profile/{id}/logo

7. Nonaktifkan profil
   DELETE /company-profile/{id}
```

---

## Catatan Keamanan

- Semua endpoint membutuhkan **Bearer Token** yang valid
- Data otomatis terisolasi per **tenant** berdasarkan `tenantId` dari JWT payload
- **Super Admin** dapat mengakses semua profil tanpa filter tenant
- Validasi file upload: ekstensi **dan** MIME type dicek sekaligus untuk mencegah *file spoofing*
- Logo lama dihapus otomatis dari disk server saat diganti atau dihapus
