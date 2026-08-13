# Panduan Penggunaan Docker (Development vs Production)

Dokumen ini berisi panduan lengkap penggunaan Docker Compose untuk aplikasi NestJS Backend, baik untuk lingkungan **Development** (dengan fitur *Hot Reload*) maupun **Production** (ter-compile dan ter-optimasi).

---

## 📋 Ringkasan Perintah

| Mode | Perintah | Fitur Utama |
| :--- | :--- | :--- |
| **Development** | `docker compose up` | Auto-reload saat save kode, volume mount lokal, instant dev |
| **Production** | `docker compose -f docker-compose.yml up -d --build` | Performa optimal, multi-stage build, berjalan di background |

---

## 🛠️ 1. Lingkungan Development (Pengembangan)

Mode ini digunakan saat Anda sedang menulis atau mengedit kode. Setiap kali file TypeScript di folder `src/` disimpan (Save), aplikasi di dalam kontainer Docker akan otomatis melakukan kompilasi ulang tanpa perlu rebuild.

### Langkah Menjalankan Development:

1. **Jalankan aplikasi (Mode Interactive / Melihat Log)**:
   ```bash
   docker compose up
   ```

2. **Jalankan aplikasi di Background**:
   ```bash
   docker compose up -d
   ```

3. **Melihat Log Aplikasi (Jika berjalan di background)**:
   ```bash
   docker compose logs -f app
   ```

4. **Jika Menambahkan Package npm Baru**:
   Setiap kali menginstall dependensi baru di `package.json`, jalankan opsi `--build`:
   ```bash
   docker compose up --build -d
   ```

5. **Menghentikan Lingkungan Development**:
   ```bash
   docker compose down
   ```

---

## 🚀 2. Lingkungan Production (Rilis / Live)

Mode ini digunakan untuk melakukan *deployment* atau menguji performa produksi aplikasi. Aplikasi di-build dalam *multi-stage Docker build* yang sangat aman dan efisien.

### Langkah Menjalankan Production:

1. **Build dan Jalankan Production**:
   ```bash
   docker compose -f docker-compose.yml up -d --build
   ```

2. **Melihat Log Production**:
   ```bash
   docker compose -f docker-compose.yml logs -f app
   ```

3. **Menghentikan Lingkungan Production**:
   ```bash
   docker compose -f docker-compose.yml down
   ```

---

## ⚙️ 3. Penjelasan Konfigurasi File

### `docker-compose.yml` (Production Base)
- Merupakan konfigurasi dasar untuk seluruh service (NestJS Backend, Redis, PostgreSQL opsional).
- Menggunakan stage `production` pada `Dockerfile`.
- Kode di-compile ke folder `dist/` dan dijalankan dengan user non-root demi keamanan.

### `docker-compose.override.yml` (Development Override)
- Otomatis dibaca oleh perintah `docker compose up`.
- Menggunakan stage `builder` pada `Dockerfile`.
- Memetakan folder lokal (`.:/app`) ke dalam kontainer.
- Menjalankan perintah `npm run start:dev` (`nest start --watch`) untuk mendukung **Hot Reload**.

---

## 💡 Troubleshooting & Tips

- **Konflik Modul Node (`node_modules`)**:
  Konfigurasi ini memisahkan `node_modules` host dan kontainer menggunakan *anonymous volume* (`/app/node_modules`), sehingga aman dijalankan di OS apa pun (Linux, Windows, macOS).
- **Restart Service Tertentu**:
  ```bash
  docker compose restart app
  ```
- **Masuk ke Terminal Kontainer**:
  ```bash
  docker compose exec app sh
  ```
