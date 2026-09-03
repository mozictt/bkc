# 📋 Panduan Instalasi Lengkap (Tanpa Docker)

> **Stack:** NestJS 11 (Backend) + Nuxt 4 (Frontend)  
> **Database:** PostgreSQL · **Cache:** Redis  
> **Node.js:** v20 LTS atau lebih baru

---

## Daftar Isi

1. [Prasyarat Sistem](#1-prasyarat-sistem)
2. [Instalasi Dependensi Sistem](#2-instalasi-dependensi-sistem)
3. [Konfigurasi PostgreSQL](#3-konfigurasi-postgresql)
4. [Konfigurasi Redis](#4-konfigurasi-redis)
5. [Setup Backend (NestJS)](#5-setup-backend-nestjs)
6. [Seeding Data Awal](#6-seeding-data-awal)
7. [Setup Frontend (Nuxt 4)](#7-setup-frontend-nuxt-4)
8. [Menjalankan Aplikasi](#8-menjalankan-aplikasi)
9. [Checklist Produksi](#9-checklist-produksi)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Prasyarat Sistem

Pastikan sistem memiliki spesifikasi minimum berikut:

| Komponen | Minimum | Rekomendasi |
|---|---|---|
| OS | Ubuntu 20.04 / Debian 11 | Ubuntu 22.04 LTS |
| CPU | 2 Core | 4 Core |
| RAM | 2 GB | 4 GB |
| Storage | 10 GB | 20 GB |
| Node.js | v20 LTS | v22 LTS |
| PostgreSQL | 14 | 16 |
| Redis | 6 | 7 |

---

## 2. Instalasi Dependensi Sistem

### 2.1 Node.js v20 LTS (via NodeSource)

```bash
# Install curl jika belum ada
sudo apt update && sudo apt install -y curl

# Tambahkan NodeSource repository untuk Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Install Node.js & npm
sudo apt install -y nodejs

# Verifikasi
node -v   # harus: v20.x.x
npm -v    # harus: 10.x.x
```

### 2.2 PostgreSQL 16

```bash
# Tambahkan repository PostgreSQL resmi
sudo apt install -y wget gnupg2
wget -qO - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" | \
  sudo tee /etc/apt/sources.list.d/pgdg.list

sudo apt update
sudo apt install -y postgresql-16 postgresql-client-16

# Start & enable service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Verifikasi
psql --version   # harus: psql (PostgreSQL) 16.x
```

### 2.3 Redis 7

```bash
# Install Redis
sudo apt install -y redis-server

# Konfigurasi Redis agar berjalan sebagai service
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Verifikasi
redis-cli ping   # harus: PONG
```

---

## 3. Konfigurasi PostgreSQL

### 3.1 Buat User & Database

```bash
# Masuk sebagai user postgres
sudo -u postgres psql
```

Jalankan perintah SQL berikut di dalam psql:

```sql
-- Buat user database
CREATE USER root WITH PASSWORD 'root';

-- Buat database
CREATE DATABASE app OWNER root;

-- Berikan semua privilege
GRANT ALL PRIVILEGES ON DATABASE app TO root;

-- Keluar
\q
```

### 3.2 Verifikasi Koneksi

```bash
psql -h localhost -U root -d app -c "SELECT version();"
# Akan diminta password: root
```

### 3.3 (Opsional) Konfigurasi Port Kustom

Jika ingin menggunakan port selain default `5432`, edit file konfigurasi:

```bash
sudo nano /etc/postgresql/16/main/postgresql.conf
```

Ubah baris:
```
# port = 5432
port = 5434    ← sesuai .env: DB_PORT=5434
```

```bash
sudo systemctl restart postgresql
```

---

## 4. Konfigurasi Redis

### 4.1 Verifikasi Port Default

Redis berjalan di port `6379` secara default. Verifikasi:

```bash
redis-cli -p 6379 ping   # PONG
```

### 4.2 (Opsional) Aktifkan Password Redis

```bash
sudo nano /etc/redis/redis.conf
```

Cari dan ubah:
```
# requirepass foobared
requirepass password_redis_anda
```

```bash
sudo systemctl restart redis-server
```

> ⚠️ Jika menggunakan password, tambahkan `REDIS_PASSWORD=...` di file `.env` backend.

---

## 5. Setup Backend (NestJS)

### 5.1 Clone / Salin Kode

```bash
cd /home/mozict/project/backend
```

### 5.2 Install Dependensi Node.js

```bash
npm install
```

### 5.3 Konfigurasi File `.env`

Salin dari template atau buat file `.env` baru:

```bash
nano .env
```

Isi dengan konfigurasi berikut (sesuaikan nilai yang bertanda `← UBAH`):

```env
# ── Database PostgreSQL ───────────────────────────────────
DB_HOST=localhost
DB_PORT=5434
DB_USERNAME=root
DB_PASSWORD=root
DB_NAME=app

# ── Aplikasi ──────────────────────────────────────────────
PORT=4000
FRONTEND_URL=http://localhost:3000

# ── Redis ─────────────────────────────────────────────────
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_TTL=3600
REDIS_ENABLED=true

# ── JWT ───────────────────────────────────────────────────
JWT_SECRET=ganti_dengan_string_rahasia_minimal_32_karakter   ← UBAH
JWT_EXPIRES_IN=10h
JWT_REFRESH_EXPIRES_IN=1d

# ── Timezone ──────────────────────────────────────────────
TZ=Asia/Jakarta
APP_TIMEZONE=Asia/Jakarta

# ── CORS ──────────────────────────────────────────────────
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# ── Master Tenant Seeder ──────────────────────────────────
MASTER_TENANT_SLUG=master
MASTER_TENANT_NAME=Master Admin
MASTER_TENANT_EMAIL=admin@domain.com       ← UBAH

# ── User Super Admin ──────────────────────────────────────
SUPER_ADMIN_USERNAME=superadmin
SUPER_ADMIN_PASSWORD=Admin@123!            ← UBAH sebelum produksi!
```

### 5.4 Sinkronisasi Database (Auto Migration)

Aplikasi menggunakan TypeORM dengan `synchronize: true` di mode development. Schema akan dibuat otomatis saat pertama kali dijalankan.

> [!IMPORTANT]
> Jalankan backend minimal **satu kali** terlebih dahulu sebelum menjalankan seeder, agar semua tabel dibuat oleh TypeORM.

```bash
# Jalankan sekali untuk membuat schema tabel
npm run start:dev
```

Tunggu hingga muncul log:
```
[NestApplication] Nest application successfully started
```

Lalu tekan `Ctrl+C` untuk stop, kemudian lanjutkan ke seeding.

---

## 6. Seeding Data Awal

> [!NOTE]
> Seeding **harus dilakukan setelah backend berhasil start** minimal satu kali agar tabel-tabel sudah terbentuk di database.

### 6.1 Jalankan Seeder Lengkap

```bash
cd /home/mozict/project/backend

npm run seed
```

Seeder akan menjalankan tiga tahap secara berurutan:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌱 Master Tenant Seeder – Starting...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 [Step 1/5] Seeding Tenant Master...
  ✅ Tenant master created: "Master Admin" (id=xxxx-xxxx-xxxx)

📦 [Step 2/5] Seeding Role Super Admin...
  ✅ Role "Super Admin" created (id=1)
  ✅ Role "Staff" created

📦 [Step 3/5] Seeding Permissions...
  ✅ 23 permissions inserted, 0 already existed.

📦 [Step 4/5] Seeding Menu Tree...
  ✅ Menu inserted: "Dashboard" (id=1)
  ✅ Menu inserted: "Dokumen" (id=2)
  ... (semua menu)

📦 [Step 5/5] Seeding User Super Admin...
  ✅ User Super Admin created: "superadmin"
  ⚠️  Password default digunakan – SEGERA ubah via aplikasi!

🏁 Master Tenant Seeder – Completed!
```

### 6.2 Data yang Di-generate Seeder

| Data | Nilai Default |
|---|---|
| **Tenant Master** | Slug: `master`, isMaster: `true`, UUID auto |
| **Role** | `Super Admin` (Full Access), `Staff` (View Only) |
| **Permissions** | 23 resource dengan `FULL_AKSES` |
| **Menu** | Dashboard, Dokumen, Galeri, Barang, System Management (+ submenus) |
| **User Super Admin** | Username: `superadmin`, Password: `Admin@123!` |
| **Data Wilayah** | Provinsi, Kabupaten, Kecamatan, Kelurahan seluruh Indonesia |

> [!WARNING]
> **Seeder aman dijalankan berulang kali (idempotent).** Jika dijalankan dua kali, tidak akan ada data yang duplikat.

---

## 7. Setup Frontend (Nuxt 4)

### 7.1 Masuk ke Direktori Frontend

```bash
cd /home/mozict/project/nuxt/tailwin/admin-dashboard
```

### 7.2 Install Dependensi

```bash
npm install
```

### 7.3 Konfigurasi File `.env`

```bash
cp .env.example .env
nano .env
```

Isi konfigurasi:

```env
# Port Aplikasi Frontend
PORT=3000

# Base URL Backend API
API_BASE=http://localhost:4000

# Nama Aplikasi (tampil di title bar browser)
NUXT_PUBLIC_APP_NAME="Admin Dashboard"
```

> [!NOTE]
> `API_BASE` mengarah ke backend NestJS. Pastikan port sesuai dengan `PORT` di `.env` backend (`4000`).

---

## 8. Menjalankan Aplikasi

### 8.1 Mode Development (Dua Terminal Terpisah)

**Terminal 1 – Backend:**
```bash
cd /home/mozict/project/backend
npm run start:dev
```
Backend berjalan di: `http://localhost:4000`  
Swagger Docs: `http://localhost:4000/api/docs`

**Terminal 2 – Frontend:**
```bash
cd /home/mozict/project/nuxt/tailwin/admin-dashboard
npm run dev
```
Frontend berjalan di: `http://localhost:3000`

### 8.2 Login Pertama Kali

| Field | Nilai |
|---|---|
| URL | `http://localhost:3000` |
| Username | `superadmin` |
| Password | `Admin@123!` |

> [!CAUTION]
> Segera ganti password Super Admin setelah login pertama!

### 8.3 Mode Production (Build)

**Backend:**
```bash
cd /home/mozict/project/backend
npm run build
npm run start:prod
# Berjalan di: http://localhost:4000
```

**Frontend:**
```bash
cd /home/mozict/project/nuxt/tailwin/admin-dashboard
npm run build
npm run preview
# Atau gunakan: node .output/server/index.mjs
```

### 8.4 Menjalankan Sebagai Service (PM2)

Install PM2 untuk menjaga aplikasi tetap berjalan di background:

```bash
sudo npm install -g pm2
```

**Jalankan Backend:**
```bash
cd /home/mozict/project/backend
npm run build
pm2 start dist/main.js --name "backend" --env production
```

**Jalankan Frontend:**
```bash
cd /home/mozict/project/nuxt/tailwin/admin-dashboard
npm run build
pm2 start node --name "frontend" -- .output/server/index.mjs
```

**Kelola PM2:**
```bash
pm2 list                    # Lihat semua proses
pm2 logs backend            # Lihat log backend
pm2 logs frontend           # Lihat log frontend
pm2 restart backend         # Restart backend
pm2 save                    # Simpan konfigurasi
pm2 startup                 # Auto-start saat reboot
```

---

## 9. Checklist Produksi

Sebelum deploy ke produksi, pastikan semua poin berikut sudah dilakukan:

### Keamanan
- [ ] `JWT_SECRET` diubah dengan string acak minimal 32 karakter
- [ ] `SUPER_ADMIN_PASSWORD` diubah dari default `Admin@123!`
- [ ] `DB_PASSWORD` menggunakan password yang kuat
- [ ] `ALLOWED_ORIGINS` diisi dengan domain produksi yang benar
- [ ] Port database **tidak** dibuka ke publik (firewall)

### Konfigurasi
- [ ] `NODE_ENV=production` ditambahkan di `.env` backend
- [ ] `FRONTEND_URL` diisi dengan URL produksi frontend
- [ ] `API_BASE` di frontend diarahkan ke URL produksi backend
- [ ] `MASTER_TENANT_EMAIL` diisi dengan email administrator nyata

### Database
- [ ] Seeder sudah dijalankan minimal satu kali
- [ ] Backup database dikonfigurasi (cron job)

### Server
- [ ] PM2 dikonfigurasi dengan `pm2 startup` + `pm2 save`
- [ ] Nginx/reverse proxy sudah dikonfigurasi (opsional)
- [ ] SSL/TLS (HTTPS) sudah aktif jika domain publik

---

## 10. Troubleshooting

### ❌ Error: `connect ECONNREFUSED 127.0.0.1:5434`
**Penyebab:** PostgreSQL tidak berjalan atau port salah.
```bash
sudo systemctl status postgresql
sudo systemctl start postgresql
# Pastikan port di postgresql.conf = 5434
```

### ❌ Error: `Redis connection refused`
**Penyebab:** Redis tidak berjalan.
```bash
sudo systemctl status redis-server
sudo systemctl start redis-server
redis-cli ping   # harus PONG
```

### ❌ Error: `relation "tenants" does not exist`
**Penyebab:** Seeder dijalankan sebelum backend pernah start (tabel belum dibuat).
```bash
# Jalankan backend dulu, tunggu sampai started, lalu Ctrl+C
npm run start:dev
# Baru jalankan seeder
npm run seed
```

### ❌ Error: `column "refreshToken" does not exist`
**Penyebab:** Tabel `users` dibuat dengan nama kolom yang berbeda.
```bash
# Cek nama kolom aktual di database
psql -h localhost -U root -d app -c "\d users"
```
Sesuaikan nama kolom di `master-tenant.seeder.ts` jika diperlukan.

### ❌ Error: `CORS policy`
**Penyebab:** URL frontend tidak ada di `ALLOWED_ORIGINS`.
```env
# Di .env backend, tambahkan URL frontend:
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,https://domain-anda.com
```

### ❌ `npm run seed` berjalan tapi tidak ada output wilayah
**Penyebab:** File SQL wilayah tidak ditemukan.
```bash
# Cek keberadaan file data wilayah di project
find /home/mozict/project/backend -name "*.sql" | grep wilayah
```

---

## Struktur Port Default

| Layanan | Port | Keterangan |
|---|---|---|
| Backend (NestJS) | `4000` | API + Swagger |
| Frontend (Nuxt) | `3000` | UI Admin Dashboard |
| PostgreSQL | `5434` | Database (kustom) |
| Redis | `6379` | Cache |
| Swagger UI | `4000/api/docs` | Dokumentasi API |
