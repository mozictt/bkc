# Implementasi Aplikasi Chatting — Analisis & Rencana Arsitektur

> Dokumen ini dibuat: 2026-09-11  
> Status: Draft / Menunggu Persetujuan

---

## Gambaran Umum

Membangun modul **Chat** terintegrasi di atas infrastruktur NestJS yang sudah ada (multi-tenant, PostgreSQL, Redis, Socket.IO). Fitur mencakup:
- 📋 **Kontak** — manajemen daftar kontak per-user/per-tenant
- 📥 **Inbox** — percakapan private (1-on-1) antar user
- 💬 **Live Chat** — pesan real-time menggunakan WebSocket (Socket.IO)
- 🧵 **Thread Group** — chat dalam grup dengan threading/reply terstruktur

---

## Analisis Arsitektur yang Ada

| Komponen | Kondisi Saat Ini | Relevansi |
|---|---|---|
| NestJS + TypeORM | ✅ Sudah ada | Basis semua modul baru |
| Socket.IO (`@nestjs/platform-socket.io`) | ✅ Sudah terpasang | Untuk Live Chat real-time |
| Redis (`ioredis`) | ✅ Sudah ada | Untuk presence, pub/sub, message queue |
| Multi-Tenancy (`TenantBaseEntity`) | ✅ Sudah ada | Semua entitas chat akan extend ini |
| User + Pegawai | ✅ Sudah ada | Identitas pengirim/penerima pesan |
| JWT Auth Guard | ✅ Sudah ada | Otentikasi WebSocket & REST |
| Swagger | ✅ Sudah ada | Dokumentasi API chat |

---

## Desain Database (Entities)

### 1. `contacts` — Daftar Kontak

```
contacts
├── id (PK)
├── tenant_id (FK → tenants)
├── owner_id (FK → users)          — pemilik kontak
├── contact_user_id (FK → users)   — user yang dikontakkan
├── nickname (varchar, nullable)    — nama alias
├── is_blocked (boolean, default false)
├── created_at, updated_at, deleted_at
```

### 2. `conversations` — Wadah Percakapan (Inbox & Group)

```
conversations
├── id (UUID, PK)
├── tenant_id (FK → tenants)
├── type (enum: 'direct' | 'group')
├── name (varchar, nullable)         — untuk grup
├── avatar (varchar, nullable)       — foto grup
├── created_by (FK → users)
├── last_message_id (FK → messages, nullable)
├── last_activity_at (timestamptz)
├── created_at, updated_at, deleted_at
```

### 3. `conversation_participants` — Peserta Percakapan

```
conversation_participants
├── id (PK)
├── conversation_id (FK → conversations)
├── user_id (FK → users)
├── role (enum: 'admin' | 'member')
├── joined_at (timestamptz)
├── last_read_at (timestamptz, nullable)
├── is_muted (boolean, default false)
├── left_at (timestamptz, nullable)
```

### 4. `messages` — Pesan

```
messages
├── id (UUID, PK)
├── tenant_id (FK → tenants)
├── conversation_id (FK → conversations)
├── sender_id (FK → users)
├── parent_message_id (FK → messages, nullable)  — untuk THREAD/REPLY
├── content (text)
├── type (enum: 'text' | 'image' | 'file' | 'audio' | 'system')
├── attachment_url (varchar, nullable)
├── attachment_name (varchar, nullable)
├── is_edited (boolean, default false)
├── edited_at (timestamptz, nullable)
├── is_deleted (boolean, default false)
├── deleted_at (timestamptz, nullable)
├── created_at, updated_at
```

### 5. `message_reactions` — Reaksi Pesan

```
message_reactions
├── id (PK)
├── message_id (FK → messages)
├── user_id (FK → users)
├── emoji (varchar)
├── created_at
```

### 6. `message_read_receipts` — Tanda Baca

```
message_read_receipts
├── id (PK)
├── message_id (FK → messages)
├── user_id (FK → users)
├── read_at (timestamptz)
```

---

## Relasi Antar Entitas

```
users ─────────< contacts (sebagai owner_id)
users ─────────< contacts (sebagai contact_user_id)
conversations ─< conversation_participants
users ─────────< conversation_participants
conversations ─< messages
users ─────────< messages (sebagai sender)
messages ──────< messages (self-reference: parent_message_id / thread)
messages ──────< message_reactions
messages ──────< message_read_receipts
```

---

## Arsitektur Modul NestJS

```
src/chat/
├── chat.module.ts
├── gateway/
│   └── chat.gateway.ts                  ← WebSocket (Socket.IO)
├── contact/
│   ├── contact.module.ts
│   ├── contact.controller.ts
│   ├── contact.service.ts
│   ├── dto/
│   │   ├── create-contact.dto.ts
│   │   └── update-contact.dto.ts
│   └── entities/
│       └── contact.entity.ts
├── conversation/
│   ├── conversation.module.ts
│   ├── conversation.controller.ts
│   ├── conversation.service.ts
│   ├── dto/
│   │   ├── create-conversation.dto.ts
│   │   └── update-conversation.dto.ts
│   └── entities/
│       ├── conversation.entity.ts
│       └── conversation-participant.entity.ts
├── message/
│   ├── message.module.ts
│   ├── message.controller.ts
│   ├── message.service.ts
│   ├── dto/
│   │   ├── send-message.dto.ts
│   │   └── update-message.dto.ts
│   └── entities/
│       ├── message.entity.ts
│       ├── message-reaction.entity.ts
│       └── message-read-receipt.entity.ts
└── presence/
    └── presence.service.ts              ← Online/Offline via Redis
```

---

## Fitur per Menu

### 📋 Kontak

| Endpoint | Method | Deskripsi |
|---|---|---|
| `/chat/contacts` | GET | Daftar semua kontak user |
| `/chat/contacts` | POST | Tambah kontak baru |
| `/chat/contacts/:id` | PATCH | Update (nickname, block) |
| `/chat/contacts/:id` | DELETE | Hapus kontak |
| `/chat/contacts/search` | GET | Cari user untuk ditambah |

### 📥 Inbox

| Endpoint | Method | Deskripsi |
|---|---|---|
| `/chat/conversations` | GET | Daftar semua inbox user (dengan last message) |
| `/chat/conversations` | POST | Buat percakapan baru (direct/group) |
| `/chat/conversations/:id` | GET | Detail percakapan + info peserta |
| `/chat/conversations/:id/messages` | GET | Histori pesan (paginated) |
| `/chat/conversations/:id/read` | POST | Tandai semua pesan sebagai terbaca |

### 💬 Live Chat (WebSocket Events)

**Client → Server:**

| Event | Deskripsi |
|---|---|
| `join_conversation` | Bergabung ke room percakapan |
| `leave_conversation` | Keluar dari room |
| `send_message` | Kirim pesan baru |
| `typing_start` | Mulai mengetik |
| `typing_stop` | Berhenti mengetik |
| `react_message` | Beri reaksi emoji |
| `mark_read` | Tandai pesan terbaca |

**Server → Client:**

| Event | Deskripsi |
|---|---|
| `new_message` | Pesan baru masuk |
| `message_updated` | Pesan diedit |
| `message_deleted` | Pesan dihapus |
| `user_typing` | Notifikasi user sedang mengetik |
| `user_online` | User online |
| `user_offline` | User offline |
| `read_receipt` | Update status baca |
| `new_reaction` | Reaksi emoji baru |

### 🧵 Thread Group

| Endpoint | Method | Deskripsi |
|---|---|---|
| `/chat/conversations/:id/messages/:msgId/threads` | GET | Ambil thread reply dari sebuah pesan |
| `/chat/conversations/:id/messages` | POST | Kirim reply (sertakan `parent_message_id`) |
| `/chat/conversations/:id/participants` | GET | Daftar peserta grup |
| `/chat/conversations/:id/participants` | POST | Tambah anggota grup |
| `/chat/conversations/:id/participants/:userId` | DELETE | Keluarkan anggota |

---

## Strategi Real-time (WebSocket + Redis)

```
┌─────────────┐     WebSocket      ┌──────────────────┐
│   Frontend  │ ←────────────────→ │  ChatGateway     │
│   (Nuxt)    │                    │  (Socket.IO)     │
└─────────────┘                    └────────┬─────────┘
                                            │
                                     Redis Pub/Sub
                                            │
                               ┌────────────┴──────────┐
                               │   MessageService       │
                               │   PresenceService      │
                               └───────────────────────┘
```

- **Redis Pub/Sub**: Sinkronisasi pesan antar instance NestJS (horizontal scaling)
- **Redis Keys untuk Presence**: `presence:{tenantId}:{userId}` dengan TTL 30 detik (heartbeat)
- **Socket.IO Rooms**: `conversation:{conversationId}` — setiap user join room saat buka chat

---

## Rencana Implementasi (Urutan)

### Fase 1 — Backend Entities & Database
- [ ] Buat 6 entitas baru (contact, conversation, participant, message, reaction, receipt)
- [ ] Pastikan semua extend `TenantBaseEntity` untuk multi-tenancy
- [ ] Tambahkan index database yang tepat untuk performa query

### Fase 2 — Modul REST API
- [ ] `ContactModule` — CRUD kontak
- [ ] `ConversationModule` — inbox + group management
- [ ] `MessageModule` — histori pesan, pagination cursor-based

### Fase 3 — WebSocket Gateway
- [ ] `ChatGateway` dengan JWT authentication di handshake WebSocket
- [ ] `PresenceService` — online/offline status menggunakan Redis
- [ ] Redis Pub/Sub untuk multi-instance support

### Fase 4 — Dokumentasi Swagger
- [ ] Anotasi semua controller & DTO
- [ ] Update `swagger.json`

---

## Pertimbangan Keamanan

| Aspek | Strategi |
|---|---|
| Autentikasi WebSocket | Validasi JWT token di `handleConnection()` gateway |
| Otorisasi room | User hanya bisa join room conversation yang dia ikuti |
| Tenant Isolation | Semua query filter by `tenantId` (TenantMiddleware sudah ada) |
| Rate Limiting | Guard rate limit untuk event `send_message` |
| Sanitasi konten | Sanitasi input pesan dari XSS sebelum disimpan ke DB |

---

## Pertanyaan Terbuka (Perlu Konfirmasi)

1. **Attachment** — Apakah upload gambar/file dalam pesan perlu diimplementasikan? Jika ya, gunakan storage lokal (Gallery/Documents yang sudah ada) atau cloud storage?
2. **Notifikasi Push** — Apakah diperlukan push notification (browser/FCM) saat ada pesan baru ketika user offline?
3. **Cross-Tenant** — Apakah inbox bisa menampilkan chat antar tenant berbeda, atau tetap isolasi per-tenant?
4. **Sumber Kontak** — Apakah kontak hanya dari user terdaftar di sistem, atau bisa input manual eksternal (email/telepon)?
5. **Fitur Tambahan Grup** — Apakah perlu fitur pesan di-pin atau pengumuman grup?
