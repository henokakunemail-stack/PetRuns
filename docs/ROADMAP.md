# Roadmap Pengerjaan — PetWalk

Urutan ini WAJIB diikuti. Jangan mengerjakan tahap berikutnya sebelum tahap sebelumnya punya fondasi yang jalan.

## Tahap 0 — Setup Project (Minggu 1)
- [ ] Inisialisasi repo (monorepo: `/backend`, `/mobile`, `/admin-dashboard`)
- [ ] Setup backend NestJS + koneksi PostgreSQL + Prisma
- [ ] Implementasi schema database sesuai `DATABASE_SCHEMA.md`
- [ ] Setup Flutter project (struktur folder untuk user app & worker app)
- [ ] Setup CI/CD dasar (lint + test on push)

## Tahap 1 — Autentikasi & Profil Dasar (Minggu 2-3)
- [ ] Register/login (email & phone) — backend + mobile
- [ ] Profil user (owner): edit data diri, alamat, lokasi
- [ ] Manajemen data hewan (CRUD pets, pilih species & breed)
- [ ] Seed data awal: species & breeds umum (anjing: Golden Retriever, Husky, Pomeranian, Shih Tzu, Poodle, Local, dll; kucing, kelinci)

## Tahap 2 — Worker Onboarding (Minggu 4-5)
- [ ] Registrasi worker (upload KTP, data rekening)
- [ ] Setup profil kerja worker (lokasi, radius, jenis hewan yang dikuasai, harga per durasi)
- [ ] Manajemen ketersediaan/jadwal worker
- [ ] Admin dashboard: fitur verifikasi worker (approve/reject)

## Tahap 3 — Pencarian & Booking (Minggu 6-8)
- [ ] List & filter worker (lokasi, jenis hewan, harga, rating)
- [ ] Detail profil worker
- [ ] Flow booking: pilih hewan, durasi, jadwal
- [ ] Notifikasi booking masuk ke worker (terima/tolak)
- [ ] Status booking (pending → accepted → in_progress → completed)

## Tahap 4 — Pembayaran (Minggu 9-10)
- [ ] Integrasi payment gateway (Midtrans/Xendit — finalisasi pilihan dulu)
- [ ] Kalkulasi otomatis: total dibayar user, komisi platform, payout worker
- [ ] Riwayat transaksi (user & worker)
- [ ] Dashboard admin: monitoring transaksi & laporan keuangan dasar

## Tahap 5 — Rating & Notifikasi (Minggu 11)
- [ ] Rating & review setelah sesi selesai
- [ ] Push notification (FCM) untuk semua event penting (booking diterima, sesi selesai, dll)

## Tahap 6 — QA & Closed Beta (Minggu 12-14)
- [ ] Testing internal menyeluruh (semua flow)
- [ ] Perbaikan bug kritikal
- [ ] Closed beta dengan worker & user asli di 1 kota
- [ ] Kumpulkan feedback, iterasi cepat

## Tahap 7 — Rilis Production (Minggu 15+)
- [ ] Submit ke Google Play Store
- [ ] Soft launch di 1 kota
- [ ] Monitoring metrik: booking selesai, retention, rating rata-rata
- [ ] Setelah stabil, mulai pengembangan iOS + submit App Store

## Fase 2 (Setelah Production Stabil)
- Live GPS tracking real-time
- Chat in-app
- Booking rutin/recurring (mingguan otomatis)
- Update foto/status selama sesi berjalan
- Sistem dispute & refund otomatis
- Program referral & promo

---
**Catatan**: estimasi waktu di atas asumsi tim kecil (1-3 developer). Sesuaikan berdasarkan kapasitas tim aktual.
