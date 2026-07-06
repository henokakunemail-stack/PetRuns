# Tech Stack — PetWalk

Stack ini sudah diputuskan. Jangan ganti tanpa diskusi dengan product owner (saya).

## Mobile App (User App & Worker App)
- **Framework**: Flutter — 1 codebase untuk Android & iOS
- **State Management**: Riverpod atau Bloc (pilih salah satu di awal project, konsisten di seluruh app)
- **Struktur**: Monorepo dengan 2 entry point (user app & worker app) yang share package internal (komponen UI, model data, API client) untuk hindari duplikasi kode

## Backend
- **Runtime**: Node.js
- **Framework**: NestJS (lebih terstruktur untuk project skala menengah-besar dengan banyak modul: auth, booking, payment, dll)
- **API**: REST API (pertimbangkan GraphQL hanya jika kompleksitas query di frontend jadi masalah nyata — jangan overengineer di awal)
- **Auth**: JWT + refresh token

## Database
- **PostgreSQL** — relasional, cocok untuk data booking, worker matching, dan relasi many-to-many (worker-species)
- **ORM**: Prisma (developer experience bagus, migration mudah dipantau)

## Real-time & Notifikasi
- **Push Notification**: Firebase Cloud Messaging (FCM)
- **Chat & Live Tracking (Fase 2)**: Socket.io di atas backend NestJS, atau Firebase Realtime Database jika ingin lebih cepat implementasi tanpa banyak infra tambahan

## Maps & Lokasi
- Google Maps SDK (Flutter plugin: `google_maps_flutter`)
- Google Places API untuk pencarian alamat/autocomplete

## Payment Gateway
- Kandidat: **Midtrans** atau **Xendit** (keduanya populer untuk pasar Indonesia, dukung e-wallet, VA, kartu kredit)
- Keputusan final: *open question*, evaluasi berdasarkan biaya transaksi & kemudahan integrasi payout ke worker

## Infrastruktur & Hosting
- **MVP/awal**: Railway atau Render (murah, cepat setup, cocok untuk tim kecil)
- **Setelah traksi naik**: migrasi ke AWS atau GCP untuk skalabilitas (RDS/Cloud SQL untuk Postgres, S3/Cloud Storage untuk foto)
- **CI/CD**: GitHub Actions untuk build & deploy otomatis

## Admin Dashboard
- **Framework**: Next.js (React) — bisa share tipe data/model dengan mobile app jika backend API well-typed (pertimbangkan tRPC atau OpenAPI codegen)
- **UI Library**: Tailwind CSS + shadcn/ui atau Ant Design (pilih yang cocok untuk dashboard data-heavy)

## Monitoring & Error Tracking
- Sentry (untuk mobile app & backend)
- Backend logging: pino atau winston

## Testing
- Backend: Jest (unit test untuk logic booking, kalkulasi harga/komisi, matching worker)
- Mobile: Flutter's built-in test framework untuk widget & unit test fitur kritikal
