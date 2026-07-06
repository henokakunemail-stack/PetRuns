# Panduan Deploy — PetWalk Backend

> Target MVP: Railway atau Render (sesuai TECH_STACK.md). Database sudah di Supabase.

## Prasyarat
1. Repo sudah di-push ke GitHub (CI di `.github/workflows/ci.yml` jalan otomatis tiap push).
2. Kredensial siap: `DATABASE_URL` + `DIRECT_URL` (Supabase), `JWT_SECRET` + `JWT_REFRESH_SECRET` (string random panjang — JANGAN pakai nilai dev), `MIDTRANS_SERVER_KEY`.

## Opsi A — Railway (paling cepat)
1. railway.app → New Project → Deploy from GitHub repo.
2. Set **Root Directory** ke `/` (repo root, karena monorepo pnpm) dan **Dockerfile Path** ke `backend/Dockerfile`.
3. Isi Environment Variables (lihat daftar di bawah).
4. Railway otomatis kasih domain `*.up.railway.app` — pakai HTTPS bawaan.

## Opsi B — Render
1. render.com → New → Web Service → connect repo.
2. Pilih **Docker** sebagai runtime, Dockerfile path: `backend/Dockerfile`, Docker context: `.` (root).
3. Isi Environment Variables, pilih instance type (Starter cukup untuk MVP).

## Environment Variables Production
| Variabel | Nilai |
|---|---|
| `DATABASE_URL` | Connection string Supabase **pooler port 6543** + `?pgbouncer=true` |
| `DIRECT_URL` | Connection string Supabase **port 5432** (untuk migrasi) |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | String random ≥32 karakter, beda satu sama lain |
| `JWT_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | `15m` / `7d` |
| `PLATFORM_COMMISSION_PERCENT` | `20` |
| `MIDTRANS_SERVER_KEY` / `MIDTRANS_CLIENT_KEY` | Dari dashboard Midtrans (sandbox dulu) |
| `MIDTRANS_IS_PRODUCTION` | `false` sampai go-live pembayaran |
| `CORS_ORIGINS` | URL admin dashboard production, mis. `https://admin.petwalk.id` |
| `PORT` | Biasanya di-set otomatis oleh platform |

## Migrasi Database
Jalankan sekali dari mesin lokal (atau release command platform):
```bash
cd backend && pnpm prisma migrate deploy
```
> Catatan: saat ini skema dibuat via `db push`. Sebelum production, buat baseline migration:
> `pnpm prisma migrate dev --name init` di lokal, commit folder `prisma/migrations`.

## Webhook Midtrans
Setelah backend punya URL publik, daftarkan di dashboard Midtrans:
`Settings → Configuration → Payment Notification URL` → `https://<domain-backend>/api/payments/webhook`

## Admin Dashboard (Vercel — gratis & cocok untuk Next.js)
1. vercel.com → Import repo → Root Directory: `admin-dashboard`.
2. Env: `NEXT_PUBLIC_API_URL=https://<domain-backend>/api`.
3. Tambahkan domain Vercel ke `CORS_ORIGINS` backend.

## Checklist Sebelum Go-Live
- [ ] Ganti semua secret dev (JWT, password DB sudah dirotasi)
- [ ] Hapus akun uji (`admin@petwalk.test`, `budi@petwalk.test`, `wati@petwalk.test`)
- [ ] `CORS_ORIGINS` dikunci ke domain asli
- [ ] Uji webhook Midtrans dari simulator sandbox
- [ ] Review Terms of Service + disclaimer liability dengan konsultan legal (lihat EXECUTION_PLAN.md)
