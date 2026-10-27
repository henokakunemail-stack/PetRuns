-- Migration: 001_init_postgis_and_schema.sql
-- PetMatch Core Data Schema with PostGIS & GIST Spatial Indexes

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 2. Users Table (encrypted PII + blind index phone_hash)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_encrypted TEXT NOT NULL,
    phone_hash VARCHAR(64) UNIQUE NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('OWNER', 'WORKER', 'ADMIN')),
    full_name_encrypted TEXT NOT NULL,
    deleted_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_phone_hash ON users(phone_hash);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);

-- 3. Worker Profiles Table (KTP/Selfie/SKCK keys, pricing tiers, PostGIS Point)
CREATE TABLE IF NOT EXISTS worker_profiles (
    id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    bio TEXT NULL,
    verification_status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (verification_status IN ('PENDING', 'VERIFIED', 'REJECTED')),
    ktp_encrypted TEXT NOT NULL,
    ktp_s3_key TEXT NOT NULL,
    selfie_s3_key TEXT NOT NULL,
    skck_s3_key TEXT NOT NULL,
    supported_pet_types TEXT[] NOT NULL DEFAULT '{}',
    price_30m NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    price_60m NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    price_120m NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    price_overnight NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    rating_avg NUMERIC(3,2) NOT NULL DEFAULT 5.00 CHECK (rating_avg >= 1.00 AND rating_avg <= 5.00),
    rating_count INT NOT NULL DEFAULT 0 CHECK (rating_count >= 0),
    is_online BOOLEAN NOT NULL DEFAULT FALSE,
    current_location GEOMETRY(Point, 4326) NULL,
    last_location_at TIMESTAMPTZ NULL
);

-- Spatial GIST index for worker location queries
CREATE INDEX IF NOT EXISTS idx_worker_profiles_current_location_gist ON worker_profiles USING GIST(current_location);
CREATE INDEX IF NOT EXISTS idx_worker_profiles_online ON worker_profiles(is_online) WHERE is_online = TRUE;
CREATE INDEX IF NOT EXISTS idx_worker_profiles_verification ON worker_profiles(verification_status);

-- 4. Pets Table
CREATE TABLE IF NOT EXISTS pets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    pet_type VARCHAR(30) NOT NULL CHECK (pet_type IN ('DOG_SMALL', 'DOG_MEDIUM', 'DOG_LARGE', 'CAT', 'OTHER')),
    breed VARCHAR(50) NULL,
    notes TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_pets_owner_id ON pets(owner_id);

-- 5. Bookings Table (escrow holds, duration, idempotency)
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES users(id),
    worker_id UUID NOT NULL REFERENCES worker_profiles(id),
    pet_id UUID NOT NULL REFERENCES pets(id),
    service_type VARCHAR(30) NOT NULL CHECK (service_type IN ('WALK', 'PLAYTIME', 'BOARDING')),
    duration_minutes INT NOT NULL CHECK (duration_minutes > 0),
    status VARCHAR(30) NOT NULL CHECK (status IN ('REQUESTED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    pickup_location GEOMETRY(Point, 4326) NOT NULL,
    gross_amount NUMERIC(10,2) NOT NULL CHECK (gross_amount >= 0),
    commission_amount NUMERIC(10,2) NOT NULL CHECK (commission_amount >= 0),
    worker_payout NUMERIC(10,2) NOT NULL CHECK (worker_payout >= 0),
    gateway_ref VARCHAR(100) NULL,
    idempotency_key UUID UNIQUE NOT NULL,
    started_at TIMESTAMPTZ NULL,
    completed_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_bookings_owner_id ON bookings(owner_id);
CREATE INDEX IF NOT EXISTS idx_bookings_worker_id ON bookings(worker_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_pickup_location_gist ON bookings USING GIST(pickup_location);
CREATE INDEX IF NOT EXISTS idx_bookings_idempotency_key ON bookings(idempotency_key);

-- 6. Service Proofs Table (start/end photo S3 keys + GPS verification)
CREATE TABLE IF NOT EXISTS service_proofs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    proof_type VARCHAR(20) NOT NULL CHECK (proof_type IN ('START_PHOTO', 'INTERIM_PHOTO', 'END_PHOTO')),
    image_s3_key TEXT NOT NULL,
    captured_location GEOMETRY(Point, 4326) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Spatial GIST index for proof location queries
CREATE INDEX IF NOT EXISTS idx_service_proofs_captured_location_gist ON service_proofs USING GIST(captured_location);
CREATE INDEX IF NOT EXISTS idx_service_proofs_booking_id ON service_proofs(booking_id);

-- 7. Reviews Table (one review per booking, 1-5 score)
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID UNIQUE NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES users(id),
    worker_id UUID NOT NULL REFERENCES worker_profiles(id),
    score INT NOT NULL CHECK (score BETWEEN 1 AND 5),
    comment TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_worker_id ON reviews(worker_id);

-- 8. Ledger Entries Table (double-entry accounting for completed bookings)
CREATE TABLE IF NOT EXISTS ledger_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id),
    entry_type VARCHAR(30) NOT NULL CHECK (entry_type IN ('DEBIT', 'CREDIT')),
    account VARCHAR(50) NOT NULL CHECK (account IN ('PLATFORM_COMMISSION', 'WORKER_PAYOUT', 'ESCROW_CAPTURE', 'ESCROW_HOLD')),
    amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
    description TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_booking_id ON ledger_entries(booking_id);

-- 9. Route Points Table (live GPS walk tracking buffer flush)
CREATE TABLE IF NOT EXISTS route_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    location GEOMETRY(Point, 4326) NOT NULL,
    speed_kmh NUMERIC(5,2) NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_route_points_booking_id ON route_points(booking_id);
CREATE INDEX IF NOT EXISTS idx_route_points_location_gist ON route_points USING GIST(location);
