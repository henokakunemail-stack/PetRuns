# PetWalk Admin Dashboard

Next.js 14 (App Router) + TypeScript + Tailwind CSS.

## Setup

```bash
cp .env.local.example .env.local
pnpm --filter @petwalk/admin-dashboard dev
```

Buka http://localhost:3001 (atau port lain sesuai `next dev`). Login pakai akun yang punya role `ADMIN` di backend (lihat `backend/seed`).

## Fitur MVP

- **Login** (`/login`) — memanggil `POST /api/auth/login`, menolak akun tanpa role `ADMIN`.
- **Verifikasi Worker** (`/dashboard/workers`) — list pending/approved/rejected, approve/reject langsung ke `PATCH /worker-profiles/:id/verification`.
- **Booking & Transaksi** (`/dashboard/bookings`) — monitoring semua booking + total komisi platform, filter by status.

## Catatan Desain

- Auth disimpan di `localStorage` (lihat `lib/auth.ts`), bukan httpOnly cookie — cukup untuk MVP internal tool dengan tim kecil. Kalau butuh keamanan lebih ketat nanti (XSS-resistant token storage), pertimbangkan proxy lewat Next.js Route Handler yang set httpOnly cookie.
- Semua endpoint admin butuh role `ADMIN` — user non-admin yang berhasil login akan ditolak di client (`isAdmin()` check) dan tetap ditolak di server (guard `@Roles('ADMIN')`).
