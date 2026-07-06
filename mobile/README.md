# PetWalk Mobile

Flutter Melos monorepo: 2 entry points + shared package.

## Struktur

```
mobile/
├── melos.yaml
├── pubspec.yaml          (workspace root)
├── apps/
│   ├── user_app/         # Flutter app — Pet Owner
│   └── worker_app/       # Flutter app — Worker
└── packages/
    └── core/             # Shared Dart package (models, API client, providers, UI components)
```

## Setup (perlu Flutter SDK terinstall)

```bash
# Bootstrap melos
npx melos bootstrap

# Atau jalankan dari root monorepo
pnpm i && cd mobile && dart run melos bootstrap
```

## State Management

Riverpod 2.x — shared providers di `packages/core/lib/src/providers/`.

## Packages Shared (core/)

- `models/` — DTO/response type definitions
- `api/` — Dio client + interceptor (JWT, refresh token)
- `providers/` — Riverpod providers (auth, pets, workers)
- `ui/` — Reusable widgets (CustomButton, PetCard, WorkerCard)
- `utils/` — Constants, formatters, validators
