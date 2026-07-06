import { matchWorkers, WorkerCandidate } from './matching.util';

const OWNER_LAT = -6.2;
const OWNER_LNG = 106.8;

function makeWorker(overrides: Partial<WorkerCandidate>): WorkerCandidate {
  return {
    id: 'w1',
    baseLatitude: OWNER_LAT,
    baseLongitude: OWNER_LNG,
    serviceRadiusKm: 10,
    averageRating: 4.5,
    priceForRequestedDuration: 50_000,
    ...overrides,
  };
}

describe('matchWorkers', () => {
  it('mengembalikan worker yang berada dalam radius layanan', () => {
    const result = matchWorkers([makeWorker({ id: 'near' })], {
      ownerLatitude: OWNER_LAT,
      ownerLongitude: OWNER_LNG,
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('near');
    expect(result[0].distanceKm).toBeCloseTo(0, 3);
  });

  it('mengecualikan worker di luar radius layanannya sendiri', () => {
    const farWorker = makeWorker({
      id: 'far',
      baseLatitude: -7.5, // jauh dari owner
      baseLongitude: 108.2,
      serviceRadiusKm: 5,
    });
    const result = matchWorkers([farWorker], {
      ownerLatitude: OWNER_LAT,
      ownerLongitude: OWNER_LNG,
    });
    expect(result).toHaveLength(0);
  });

  it('mengecualikan worker tanpa harga untuk durasi yang diminta', () => {
    const worker = makeWorker({ priceForRequestedDuration: null });
    const result = matchWorkers([worker], { ownerLatitude: OWNER_LAT, ownerLongitude: OWNER_LNG });
    expect(result).toHaveLength(0);
  });

  it('mengecualikan worker tanpa base lokasi', () => {
    const worker = makeWorker({ baseLatitude: null });
    const result = matchWorkers([worker], { ownerLatitude: OWNER_LAT, ownerLongitude: OWNER_LNG });
    expect(result).toHaveLength(0);
  });

  it('filter maxPrice mengecualikan worker yang lebih mahal', () => {
    const cheap = makeWorker({ id: 'cheap', priceForRequestedDuration: 30_000 });
    const expensive = makeWorker({ id: 'expensive', priceForRequestedDuration: 100_000 });
    const result = matchWorkers([cheap, expensive], {
      ownerLatitude: OWNER_LAT,
      ownerLongitude: OWNER_LNG,
      maxPrice: 50_000,
    });
    expect(result.map((r) => r.id)).toEqual(['cheap']);
  });

  it('filter minRating mengecualikan worker rating rendah', () => {
    const highRated = makeWorker({ id: 'high', averageRating: 4.8 });
    const lowRated = makeWorker({ id: 'low', averageRating: 2.0 });
    const result = matchWorkers([highRated, lowRated], {
      ownerLatitude: OWNER_LAT,
      ownerLongitude: OWNER_LNG,
      minRating: 4,
    });
    expect(result.map((r) => r.id)).toEqual(['high']);
  });

  it('mengurutkan hasil dari yang terdekat', () => {
    const nearby = makeWorker({
      id: 'nearby',
      baseLatitude: -6.21,
      baseLongitude: 106.81,
      serviceRadiusKm: 50,
    });
    const farther = makeWorker({
      id: 'farther',
      baseLatitude: -6.4,
      baseLongitude: 107.0,
      serviceRadiusKm: 50,
    });
    const result = matchWorkers([farther, nearby], {
      ownerLatitude: OWNER_LAT,
      ownerLongitude: OWNER_LNG,
    });
    expect(result.map((r) => r.id)).toEqual(['nearby', 'farther']);
  });
});
