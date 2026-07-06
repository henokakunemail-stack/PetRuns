import { haversineDistanceKm } from './geo.util';

export interface WorkerCandidate {
  id: string;
  baseLatitude: number | null;
  baseLongitude: number | null;
  serviceRadiusKm: number | null;
  averageRating: number | null;
  /** harga untuk durasi yang diminta, null kalau worker tidak menyediakan durasi ini */
  priceForRequestedDuration: number | null;
}

export interface WorkerMatchResult extends WorkerCandidate {
  distanceKm: number;
}

export interface MatchFilters {
  ownerLatitude: number;
  ownerLongitude: number;
  maxPrice?: number;
  minRating?: number;
}

/**
 * Filter & urutkan worker berdasarkan jarak (terdekat dulu).
 * Aturan:
 * - Worker tanpa base lokasi di-skip (tidak bisa dihitung jaraknya)
 * - Worker di-skip kalau jarak > service_radius_km miliknya sendiri
 * - Worker di-skip kalau tidak punya harga untuk durasi yang diminta
 * - Filter opsional: maxPrice, minRating
 *
 * Pure function — mudah di-unit-test tanpa Prisma/database.
 */
export function matchWorkers(
  candidates: WorkerCandidate[],
  filters: MatchFilters,
): WorkerMatchResult[] {
  const results: WorkerMatchResult[] = [];

  for (const candidate of candidates) {
    if (candidate.baseLatitude == null || candidate.baseLongitude == null) continue;
    if (candidate.priceForRequestedDuration == null) continue;

    const distanceKm = haversineDistanceKm(
      filters.ownerLatitude,
      filters.ownerLongitude,
      candidate.baseLatitude,
      candidate.baseLongitude,
    );

    const radius = candidate.serviceRadiusKm ?? 0;
    if (distanceKm > radius) continue;

    if (filters.maxPrice != null && candidate.priceForRequestedDuration > filters.maxPrice) {
      continue;
    }

    if (filters.minRating != null && (candidate.averageRating ?? 0) < filters.minRating) {
      continue;
    }

    results.push({ ...candidate, distanceKm });
  }

  return results.sort((a, b) => a.distanceKm - b.distanceKm);
}
