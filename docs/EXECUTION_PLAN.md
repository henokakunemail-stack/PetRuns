# EXECUTION PLAN — PetWalk menuju Live

> Dibuat 2026-07-06. Melengkapi `ROADMAP.md` dengan rencana eksekusi konkret + keputusan yang sudah diambil.

## Keputusan Arsitektur (menutup open questions di CLAUDE.md)

| Keputusan | Pilihan |
|---|---|
| Payment gateway | **Midtrans** (Snap). Dibangun di belakang interface `PaymentGatewayAdapter` agar bisa ganti provider tanpa ubah domain logic. |
| Verifikasi worker | **Administratif saja** — KTP + data rekening, approve manual oleh admin. Tidak wajib sertifikasi resmi handling hewan di MVP. |
| Asuransi/liability | **Disclaimer di Terms of Service** saja untuk MVP. Tidak ada asuransi pihak ketiga dulu. *(Bukan nasihat hukum — review dengan konsultan legal sebelum rilis publik.)* |
| Komisi platform | Default **20%**, disimpan sebagai env var `PLATFORM_COMMISSION_PERCENT` agar mudah diubah tanpa redeploy kode. |
| Branding | Tetap **PetWalk** untuk sekarang — rename di kemudian hari hanya cari-ganti string, tidak mempengaruhi arsitektur. |
| Infra | User belum punya akun apapun (hosting, DB, Firebase, Play Console, Midtrans). Semua kode/config disiapkan siap-pakai + panduan setup akun (lihat bagian Go-Live Checklist). |

## Fase Eksekusi

### Fase A — Fondasi (blocker sebelum fitur baru)
- [x] Audit project & identifikasi gap
- [ ] `git init` + commit baseline — **butuh aksi Anda**: folder ini melindungi file dari delete/rename lewat tool saya, yang bikin git tidak bisa jalan dari sisi saya. Jalankan sendiri: `git init && git add -A && git commit -m "baseline"` di folder project.
- [x] `RolesGuard` + `@Roles()` decorator + endpoint admin verifikasi worker (`GET /worker-profiles/admin/pending`, `GET /worker-profiles/admin/all`, `PATCH /worker-profiles/:id/verification`)
- [x] Fixed bug kritikal: `PrismaModule` belum `@Global()` — semua module (auth, users, pets, dst) akan gagal resolve dependency saat runtime tanpa ini
- [x] Unit test: `auth.service.spec.ts` (hashing password, validasi login/register, default role) + full test suite modul booking (lihat Fase B)

### Fase B — Booking Module (Tahap 3, gap MVP terbesar) — ✅ SELESAI
- [x] Endpoint pencarian worker (`GET /bookings/search-workers`) — filter species, radius dari lokasi user, harga, rating
- [x] Booking service: create, accept/reject, status transition (pending→accepted→in_progress→completed/cancelled) via state machine eksplisit, validasi jadwal vs `worker_availability`, deteksi bentrok jadwal
- [x] Kalkulasi harga & komisi otomatis dari `worker_pricing` saat booking dibuat (`PLATFORM_COMMISSION_PERCENT` env, default 20%)
- [x] 26 unit test untuk logic pure (haversine distance, matching, state machine status, kalkulasi komisi) — semua **passing**. Test service (mocked Prisma) tertulis tapi belum bisa dijalankan di sandbox saya karena `prisma generate` diblokir jaringan sandbox (lihat catatan di bawah) — jalankan `pnpm test` di komputer Anda untuk verifikasi penuh.

### Fase C — Payment Module (Tahap 4) — ✅ SELESAI
- [x] `PaymentGatewayAdapter` interface + implementasi Midtrans Snap (sandbox mode) — `backend/src/modules/payments`
- [x] Webhook handler notifikasi Midtrans (verifikasi signature SHA512) → update status payment
- [x] Kalkulasi komisi platform vs payout worker (sudah ada dari Fase B) + mapping status transaksi Midtrans, full unit test (signature, status mapping, service)
- [x] Payout tracking dasar — modul `payouts` (admin create + list per worker), manual admin trigger sesuai desain MVP

### Fase D — Rating & Admin Dashboard (Tahap 2 lanjutan + Tahap 5) — ✅ SELESAI
- [x] `RolesGuard` dipakai di endpoint admin worker-profiles (sudah ada) + endpoint baru `GET /bookings/admin/all` untuk monitoring
- [x] Reviews module (submit rating setelah booking completed, validasi 1x per booking, auto-update `WorkerProfile.averageRating`) — `backend/src/modules/reviews`
- [x] Admin dashboard (Next.js 14 + Tailwind): login admin, verifikasi worker (approve/reject + filter status), monitoring booking & total komisi — `admin-dashboard/`, diverifikasi jalan di browser

### Fase E — Mobile Wiring — ✅ SELESAI (kode), belum dites di device fisik
- [x] User app: search worker (GPS + filter species/durasi), detail worker, flow booking, riwayat booking, bayar (redirect Midtrans Snap), beri rating
- [x] Worker app: terima/tolak/mulai/selesaikan booking (wiring `worker_bookings_screen` ke API asli), wizard profil (bio/bank/lokasi, spesialisasi, harga, jadwal ketersediaan dengan time picker)
- [x] Perbaikan bug signifikan yang ditemukan saat wiring: `BookingStatus` di Dart memetakan ke string UPPERCASE padahal backend pakai lowercase/`in_progress`; route `/worker-profile/me` dkk salah (harusnya `/worker-profiles/me`, `/expertise`, `/pricing`, `/availability`); `UserModel.role` singular padahal backend kirim `roles` array; `StateProvider` tidak ada di Riverpod 3.x; `worker_profile_setup_screen.dart` punya syntax error fatal (bracket tidak seimbang) yang bikin seluruh file gagal parse — ditulis ulang bersih
- [ ] Push notification (FCM) — butuh Firebase project dari user, belum diimplementasi

### Fase F — QA & Deployment Readiness
- [ ] CI dasar (GitHub Actions: lint + test on push)
- [ ] Dockerfile backend + panduan deploy (Railway/Render)
- [ ] Checklist keamanan dasar (rate limiting, helmet, CORS, secrets di env bukan kode)

### Fase G — Go-Live (butuh aksi Anda, tidak bisa saya lakukan otomatis)
Hal-hal berikut perlu identitas/pembayaran asli milik Anda — saya siapkan semua kode & instruksinya, tapi pendaftaran akunnya harus Anda sendiri:
1. Buat akun **Supabase**/PostgreSQL hosting → isi `DATABASE_URL` production
2. Buat akun **Railway/Render** → deploy backend dari repo
3. Buat akun **Midtrans** (merchant, perlu dokumen bisnis) → isi API key sandbox lalu production
4. Buat **Firebase project** → isi kredensial FCM untuk push notification
5. Buat akun **Google Play Console** (biaya sekali $25) → build APK/AAB signed, submit untuk review
6. (Setelah Android stabil) Buat **Apple Developer Program** (~$99/tahun) untuk rilis iOS
7. Review **Terms of Service & liability disclaimer** dengan konsultan legal sebelum rilis publik

## Catatan Verifikasi (update terbaru)

Update: di sesi berikutnya, `npx prisma generate` **berhasil** jalan langsung (tidak lagi diblokir jaringan) — jadi seluruh verifikasi di bawah ini sudah dijalankan penuh, bukan cuma pure-logic test:
- Backend: `tsc --noEmit` bersih, `eslint` 0 error (config dimigrasi ke flat config untuk ESLint v9 — file lama `.eslintrc.js` tidak kompatibel dan bikin `pnpm lint` gagal total sebelumnya), `jest` **79/79 test passing** (termasuk 1 test yang tadinya salah tulis assertion-nya — sudah diperbaiki, bukan bug security).
- Admin dashboard: `next build` sukses, dicoba langsung di browser (login form, validasi, redirect auth guard) — semua berfungsi.
- Mobile (`core`, `user_app`, `worker_app`): `flutter analyze` bersih di ketiganya, `flutter test` passing di kedua app. Ditemukan & diperbaiki beberapa bug nyata (lihat Fase E) yang sebelumnya bikin `flutter analyze` gagal total dengan puluhan error.
- **Verifikasi end-to-end lawan database Supabase sungguhan (2026-07-06)** — semua lolos:
  - `prisma db push` sukses (skema 12 tabel ter-deploy), seed species+breeds sukses. Catatan penting: koneksi pooler port 6543 (transaction mode) TIDAK bisa dipakai untuk migrasi — schema.prisma sekarang punya `directUrl` (port 5432) khusus untuk itu.
  - Flow lengkap diuji live via API: register owner & worker → lengkapi profil worker (bio/lokasi/keahlian/harga/jadwal) → admin approve → search worker (jarak & harga benar) → buat booking (komisi 20% terhitung benar: 90rb → 18rb komisi, 72rb payout) → worker terima → mulai → selesaikan → owner beri rating (duplikat ditolak, `averageRating` ter-update otomatis).
  - **2 bug keamanan ditemukan & diperbaiki saat uji live**: (1) `passwordHash` bocor di respons booking (include user penuh) dan di `GET /users/:id` — sekarang semua pakai select terbatas; (2) `GET /api/health` tadinya kena guard JWT (401) padahal harus publik untuk monitoring — sudah ditandai `@Public()`.
  - Error gateway pembayaran sekarang dikembalikan sebagai 502 dengan pesan jelas (bukan 500 generik) — detail teknis hanya masuk log server.
  - Akun uji di database: `admin@petwalk.test`, `budi@petwalk.test` (owner), `wati@petwalk.test` (worker) — hapus sebelum production.
- **Belum diverifikasi**: pembayaran Midtrans sungguhan (butuh server key sandbox asli di `MIDTRANS_SERVER_KEY`), dan mobile app di emulator/device fisik.
- **Aksi Anda**: (1) isi `MIDTRANS_SERVER_KEY` sandbox asli lalu uji flow bayar; (2) `flutter run` di emulator untuk uji end-to-end dari sisi mobile; (3) **rotasi password database di dashboard Supabase** karena sempat terbagikan dalam percakapan chat.

---
**Status update**: dokumen ini akan saya update seiring progres tiap fase. Lihat task list untuk status paling baru.
