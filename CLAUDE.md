# CLAUDE.md — Konteks Project untuk Claude Code

> File ini dibaca otomatis oleh Claude Code setiap sesi. Jangan hapus. Update jika ada keputusan arsitektur baru.

## Nama Project
**PetWalk** (nama sementara — bisa diganti nanti)

## Ringkasan Konsep
Marketplace jasa jalan-jalan hewan peliharaan (pet walking) yang menghubungkan **pemilik hewan yang sibuk** dengan **worker/pekerja lepas** yang bersedia mengajak hewan jalan-jalan. Terdiri dari 2 aplikasi mobile (User App & Worker App) + 1 admin dashboard (web).

Model mirip Rover/Wag, tapi disesuaikan pasar lokal Indonesia dan mendukung multi-jenis hewan (tidak hanya anjing).

## Target Platform
- **Fase 1**: Android (prioritas rilis pertama)
- **Fase 2**: iOS (setelah MVP Android stabil)
- **Strategi**: Gunakan **Flutter** untuk single codebase Android+iOS agar tidak develop 2x. Jangan pilih native Kotlin/Swift terpisah kecuali ada alasan kuat.

## Dokumen Referensi Wajib Dibaca
Sebelum mengerjakan task apapun, baca dulu:
1. `docs/PRD.md` — daftar fitur lengkap tiap aplikasi
2. `docs/DATABASE_SCHEMA.md` — struktur data & relasi tabel
3. `docs/TECH_STACK.md` — stack teknis yang sudah diputuskan, jangan ganti tanpa diskusi
4. `docs/ROADMAP.md` — urutan pengerjaan fitur (MVP dulu, jangan loncat ke fitur fase 2)

## Prinsip Kerja untuk Claude Code
- **Ikuti urutan roadmap.** Jangan bangun fitur fase 2 (live GPS tracking, chat, kalender kompleks) sebelum MVP fase 1 selesai dan berjalan.
- **Struktur data hewan harus generic sejak awal**: tabel `species` → `breeds` → `pets`, bukan hardcode "anjing" di kode. Anjing adalah kategori utama tapi sistem harus mendukung kucing, kelinci, dll.
- **Worker punya keahlian per jenis hewan** (many-to-many), bukan satu jenis saja.
- **Dua aplikasi terpisah** secara UX (User App vs Worker App), tapi boleh share codebase/komponen lewat monorepo jika itu mempercepat development — putuskan struktur folder di awal dan konsisten.
- **Backend harus API-first** (REST atau GraphQL) supaya bisa dipakai User App, Worker App, dan Admin Dashboard sekaligus.
- Setiap kali membuat fitur baru, tanyakan dulu ke saya jika ada keputusan yang mempengaruhi arsitektur (misal: ganti database, ganti state management, dsb) — jangan asumsikan sendiri.
- Tulis kode yang siap untuk tim kecil maintain, prioritaskan clarity di atas cleverness.
- Sertakan unit test dasar untuk logic penting (matching worker, kalkulasi harga, booking).

## Model Bisnis
Komisi per transaksi dari worker (target 15-20%, masih bisa berubah). Ini mempengaruhi desain sistem pembayaran — pastikan ada pemisahan jelas antara "total dibayar user", "komisi platform", dan "payout ke worker".

## Yang BELUM diputuskan (tandai sebagai open question, jangan asumsi)
- Payment gateway final: Midtrans vs Xendit
- Apakah worker perlu verifikasi sertifikasi resmi handling hewan atau cukup background check administratif
- Kebijakan asuransi jika hewan/worker cedera saat sesi jalan
- Nama final aplikasi & branding

## Status Project
🔵 **Tahap: Setup awal / pre-development.** Belum ada kode. Mulai dari struktur project, setup backend, dan schema database sesuai `docs/DATABASE_SCHEMA.md`.
