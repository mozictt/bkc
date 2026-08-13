# ============================================================
# Stage 1: Builder — Install deps & build aplikasi NestJS
# ============================================================
FROM node:24-alpine AS builder

# Install dependensi sistem yang dibutuhkan untuk bcrypt (node-gyp)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files dulu (optimasi Docker layer cache)
COPY package*.json ./

# Install SEMUA dependensi termasuk devDeps untuk proses build
RUN npm ci

# Copy seluruh source code
COPY . .

# Build aplikasi NestJS ke dist/
RUN npm run build

# ============================================================
# Stage 2: Production — Image final yang ringan & aman
# ============================================================
FROM node:24-alpine AS production

# Install FFmpeg (dibutuhkan VideoTranscoderService untuk MP4 FastStart)
# Install tzdata untuk konfigurasi timezone Asia/Jakarta
RUN apk add --no-cache ffmpeg tzdata

# Set timezone default ke Asia/Jakarta
ENV TZ=Asia/Jakarta

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install HANYA production dependencies (lebih ringan)
RUN npm ci --omit=dev && npm cache clean --force

# Copy hasil build dari stage builder
COPY --from=builder /app/dist ./dist

# Copy file konfigurasi runtime
COPY nest-cli.json ./
COPY tsconfig.json ./

# Buat direktori storage dengan permission yang benar
# Volume akan di-mount di sini agar data persisten
RUN mkdir -p storage/uploads/gallery && \
    chown -R node:node /app

# Gunakan user non-root untuk keamanan (principle of least privilege)
USER node

# Expose port aplikasi
EXPOSE 4000

# Health check — pastikan aplikasi merespons sebelum dianggap "healthy"
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:4000/api/docs-json || exit 1

# Jalankan aplikasi dari dist/
CMD ["node", "dist/main"]
