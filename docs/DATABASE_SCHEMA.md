# Database Schema — PetWalk (Draft Awal)

> Ini rancangan awal, boleh disesuaikan Claude Code saat implementasi, tapi struktur relasi inti (species → breed → pet, worker ↔ species expertise) harus dipertahankan.

## Prinsip Desain
- PostgreSQL, relasional.
- Semua tabel pakai `id` UUID sebagai primary key.
- Gunakan `created_at`, `updated_at` di semua tabel.
- Soft delete (`deleted_at`) untuk data penting (users, pets, bookings).

## Tabel Inti

### `users`
Akun dasar untuk semua orang (baik jadi pet owner maupun calon worker bisa pakai 1 akun, dibedakan lewat role).
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | PK |
| name | varchar | |
| email | varchar | unique |
| phone | varchar | unique |
| password_hash | varchar | |
| role | enum | `owner`, `worker`, `admin` — user bisa punya lebih dari satu role (pertimbangkan tabel pivot jika perlu) |
| profile_photo_url | varchar | |
| address | text | |
| latitude / longitude | decimal | lokasi utama user |
| created_at / updated_at / deleted_at | timestamp | |

### `species`
Kategori utama jenis hewan.
| Kolom | Tipe |
|---|---|
| id | uuid |
| name | varchar (contoh: "Anjing", "Kucing", "Kelinci", "Lainnya") |

### `breeds`
Ras/jenis spesifik, terutama untuk anjing.
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | |
| species_id | uuid (FK → species.id) | |
| name | varchar | contoh: "Golden Retriever", "Husky", "Pomeranian", "Shih Tzu", "Local/Kampung" |

### `pets`
Hewan peliharaan milik user (owner).
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | |
| owner_id | uuid (FK → users.id) | |
| species_id | uuid (FK → species.id) | |
| breed_id | uuid (FK → breeds.id, nullable) | nullable karena breed bisa "tidak diketahui/campuran" |
| name | varchar | nama hewan |
| age | int | dalam bulan/tahun |
| weight_kg | decimal | |
| temperament_notes | text | agresif, jinak, takut orang asing, dll |
| medical_notes | text | alergi, kondisi khusus |
| photo_url | varchar | |

### `worker_profiles`
Data tambahan khusus untuk user yang berperan sebagai worker.
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | |
| user_id | uuid (FK → users.id) | |
| bio | text | |
| verification_status | enum | `pending`, `approved`, `rejected` |
| ktp_document_url | varchar | |
| bank_account_number | varchar | |
| bank_name | varchar | |
| service_radius_km | decimal | radius area layanan dari lokasi worker |
| base_latitude / base_longitude | decimal | titik pusat area layanan |
| average_rating | decimal | dihitung dari reviews |
| total_completed_sessions | int | |

### `worker_species_expertise`
Relasi many-to-many: worker bisa handle beberapa jenis hewan.
| Kolom | Tipe |
|---|---|
| id | uuid |
| worker_profile_id | uuid (FK → worker_profiles.id) |
| species_id | uuid (FK → species.id) |

### `worker_pricing`
Worker menentukan harga per durasi sendiri (fleksibel, bukan fixed slot).
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | |
| worker_profile_id | uuid (FK) | |
| duration_minutes | int | contoh: 30, 60, 90 |
| price | decimal | harga dalam Rupiah untuk durasi ini |

### `worker_availability`
Jadwal ketersediaan worker.
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | |
| worker_profile_id | uuid (FK) | |
| day_of_week | int | 0-6 |
| start_time | time | |
| end_time | time | |

### `bookings`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | |
| owner_id | uuid (FK → users.id) | |
| worker_profile_id | uuid (FK → worker_profiles.id) | |
| pet_id | uuid (FK → pets.id) | |
| scheduled_start | timestamp | |
| duration_minutes | int | |
| price_total | decimal | total dibayar user |
| platform_commission | decimal | komisi platform |
| worker_payout | decimal | pendapatan bersih worker |
| status | enum | `pending`, `accepted`, `rejected`, `in_progress`, `completed`, `cancelled` |
| owner_notes | text | instruksi khusus dari owner |
| actual_start / actual_end | timestamp | waktu aktual sesi berlangsung |

### `reviews`
| Kolom | Tipe |
|---|---|
| id | uuid |
| booking_id | uuid (FK → bookings.id) |
| rating | int (1-5) |
| comment | text |
| created_at | timestamp |

### `payments`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | |
| booking_id | uuid (FK) | |
| amount | decimal | |
| payment_method | varchar | contoh: e-wallet, kartu kredit, transfer |
| payment_gateway_ref | varchar | reference id dari Midtrans/Xendit |
| status | enum | `pending`, `paid`, `failed`, `refunded` |

### `payouts`
Pencairan dana ke worker.
| Kolom | Tipe |
|---|---|
| id | uuid |
| worker_profile_id | uuid (FK) |
| amount | decimal |
| status | enum (`pending`, `processed`, `failed`) |
| processed_at | timestamp |

## Catatan Relasi Penting
```
species (1) ──< (banyak) breeds
species (1) ──< (banyak) pets
breeds  (1) ──< (banyak) pets
users   (1) ──< (banyak) pets [sebagai owner]
users   (1) ─── (1) worker_profiles
worker_profiles (banyak) ──< >── (banyak) species  [lewat worker_species_expertise]
worker_profiles (1) ──< (banyak) worker_pricing
worker_profiles (1) ──< (banyak) worker_availability
bookings ─── owner, worker_profile, pet (semua FK)
bookings (1) ─── (1) payments
bookings (1) ─── (0..1) reviews
```
