# PetWalk

Marketplace jasa jalan-jalan hewan peliharaan (pet walking) yang menghubungkan pemilik hewan yang sibuk dengan worker/pekerja lepas.

## Struktur Monorepo

```
petwalk/
├── backend/              # NestJS API + Prisma ORM + PostgreSQL
├── admin-dashboard/      # Next.js admin dashboard
├── mobile/
│   ├── apps/
│   │   ├── user_app/     # Flutter app untuk pet owner
│   │   └── worker_app/   # Flutter app untuk worker
│   └── packages/
│       └── core/         # Shared Flutter code (models, API client, UI components, Riverpod providers)
├── docs/                 # PRD, schema, tech stack, roadmap
├── package.json          # Root monorepo config
├── pnpm-workspace.yaml   # pnpm workspace declaration
└── turbo.json            # Turborepo pipeline config
```

## Tech Stack (lihat docs/TECH_STACK.md untuk detail lengkap)

- **Backend**: NestJS + Prisma + PostgreSQL (Supabase)
- **Mobile**: Flutter + Riverpod (Melos monorepo, 2 entry points)
- **Admin Dashboard**: Next.js + Tailwind + shadcn/ui
- **Monorepo tooling**: pnpm workspaces + Turborepo
- **Auth**: JWT + refresh token
- **Push Notification**: FCM
- **Maps**: Google Maps SDK
- **CI/CD**: GitHub Actions

## Quick Start

Prasyarat:
- Node.js >= 20
- pnpm >= 9
- Flutter >= 3.x
- PostgreSQL database (Supabase atau lokal)

```bash
# Install dependencies
pnpm install

# Jalankan backend
pnpm dev:backend

# Jalankan admin dashboard
pnpm dev:admin

# Mobile (lihat mobile/README.md)
cd mobile && melos bootstrap
```

## Status Project

🔵 **Tahap 0 — Setup Project**. Lihat `docs/ROADMAP.md` untuk urutan lengkap.
