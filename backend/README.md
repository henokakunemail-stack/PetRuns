# PetWalk Backend

NestJS API + Prisma ORM + PostgreSQL (Supabase).

## Setup

```bash
# Install deps (dari root monorepo)
pnpm install

# Setup env
cp .env.example .env
# Edit DATABASE_URL dengan connection string Supabase / Postgres lokal

# Generate Prisma client
pnpm --filter @petwalk/backend prisma:generate

# Jalankan migration
pnpm --filter @petwalk/backend prisma:migrate

# Start dev server
pnpm dev:backend
```

## Struktur Module

```
src/
├── main.ts
├── app.module.ts
├── prisma/
│   ├── prisma.module.ts
│   └── prisma.service.ts
├── health/
│   └── health.controller.ts
└── modules/
    ├── auth/        # JWT auth (Tahap 1)
    ├── users/       # User profile & management
    ├── species/     # Kategori jenis hewan
    ├── breeds/      # Ras hewan
    └── pets/        # Hewan peliharaan owner
```

Lihat `prisma/schema.prisma` untuk struktur database lengkap dan `docs/DATABASE_SCHEMA.md` untuk referensi.
