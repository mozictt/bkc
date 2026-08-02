# Dokumentasi API - Album & Galeri Media

Dokumen ini berisi detail rute API, *request payload*, dan struktur respons untuk modul Album (Momen) dan Galeri Media.
Semua rute di bawah ini dilindungi secara global oleh `JwtAuthGuard`. Pastikan Anda menyertakan *header* otorisasi pada setiap *request*.

**Base URL**: `http://localhost:3000` (Sesuaikan dengan *environment* Anda)
**Authentication**: Bearer Token (`Authorization: Bearer <token>`)

---

## BAGIAN A: ALBUM (MOMEN)

Album berfungsi sebagai folder atau "momen" tempat foto dan video akan dikelompokkan.

### 1. Buat Album Baru
*   **Endpoint**: `POST /albums`
*   **Content-Type**: `application/json`

**Request Body:**
```json
{
  "name": "Liburan Bali",
  "description": "Dokumentasi acara liburan 2024",
  "date": "2024-03-24"
}
```
*(Catatan: `description` dan `date` bersifat opsional).*

### 2. Ambil Semua Album
Mengambil semua daftar album beserta media yang ada di dalamnya secara otomatis.
*   **Endpoint**: `GET /albums`

### 3. Ambil Detail Satu Album
*   **Endpoint**: `GET /albums/:id`
*   **Parameter URL**: `id` (UUID dari album).

### 4. Update Album
*   **Endpoint**: `PATCH /albums/:id`
*   **Request Body**: Sama seperti proses pembuatan, Anda bisa mengirimkan sebagian data (contoh: hanya `name`).

### 5. Hapus Album
Menghapus album, dan secara otomatis (cascade delete) menghapus *seluruh media fisik dan database* yang ada di dalam album tersebut.
*   **Endpoint**: `DELETE /albums/:id`

---

## BAGIAN B: GALERI MEDIA

Mengelola isi foto dan video di dalam sebuah album.

### 1. Unggah Media Majemuk (Bulk Upload)
Mengunggah banyak file gambar atau video sekaligus dan memasukkannya ke dalam sebuah album.

*   **Endpoint**: `POST /gallery/upload-bulk`
*   **Content-Type**: `multipart/form-data`

**Request Body (Form Data):**
| Key | Tipe | Wajib | Keterangan |
| :--- | :--- | :---: | :--- |
| `files` | `File[]` | Ya | File media (Bisa dipilih banyak, maksimal 20 file). Maks 50MB per file. Ekstensi: `.jpg, .jpeg, .png, .webp, .mp4, .webm`. |
| `albumId` | `UUID` | Tidak | ID dari Album tempat foto akan disimpan. Jika kosong, media tidak memiliki album (Uncategorized). |

**Respons Sukses (201 Created):**
```json
{
  "message": "Berhasil mengunggah file media",
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "albumId": "UUID_ALBUM",
      "fileName": "17112002-abc-def.jpg",
      "originalName": "foto1.jpg",
      "mimeType": "image/jpeg",
      "size": 1048576,
      "path": "/gallery/media/17112002-abc-def.jpg",
      "type": "photo",
      "createdAt": "2024-03-24T10:00:00.000Z"
    }
  ]
}
```

### 2. Dapatkan/Stream Media Fisik (Secure View)
Digunakan untuk menampilkan gambar di `<img src>` via `Blob` atau memutar video dengan aman.

*   **Endpoint**: `GET /gallery/media/:filename`
*   **Parameter URL**: `filename` (Contoh: `17112002-abc-def.jpg`)
*   **Cara Penggunaan**: Gunakan fungsi bawaan *fetch* untuk mengambil Blob karena butuh *Authorization Header*. (Lihat panduan `nuxt_secure_media_guide.md`).

### 3. Ambil Semua Daftar Media (Raw)
Mengambil daftar media langsung, terlepas dari album mana ia berada.
*   **Endpoint**: `GET /gallery`

### 4. Ambil Detail Satu Media
*   **Endpoint**: `GET /gallery/:id`

### 5. Update Metadata Media (Pindah Album)
Digunakan jika Anda ingin memindahkan sebuah foto ke album lain.
*   **Endpoint**: `PATCH /gallery/:id`
*   **Request Body JSON:** `{"albumId": "UUID_ALBUM_BARU"}`

### 6. Hapus Satu Media Saja
Menghapus rekaman satu media dari *Database* sekaligus menghapus permanen file fisik di server.
*   **Endpoint**: `DELETE /gallery/:id`
