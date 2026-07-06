import { haversineDistanceKm } from './geo.util';

describe('haversineDistanceKm', () => {
  it('jarak titik yang sama adalah 0', () => {
    expect(haversineDistanceKm(-6.2, 106.8, -6.2, 106.8)).toBeCloseTo(0, 5);
  });

  it('menghitung jarak Monas ke Kota Tua Jakarta (~5.5 km) dengan toleransi wajar', () => {
    // Monas: -6.1754, 106.8272 | Kota Tua: -6.1352, 106.8133
    const distance = haversineDistanceKm(-6.1754, 106.8272, -6.1352, 106.8133);
    expect(distance).toBeGreaterThan(3);
    expect(distance).toBeLessThan(8);
  });

  it('simetris — jarak A ke B sama dengan B ke A', () => {
    const ab = haversineDistanceKm(-6.2, 106.8, -6.9, 107.6);
    const ba = haversineDistanceKm(-6.9, 107.6, -6.2, 106.8);
    expect(ab).toBeCloseTo(ba, 8);
  });
});
