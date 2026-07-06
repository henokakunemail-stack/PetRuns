import { calculateCommissionBreakdown } from './pricing.util';

describe('calculateCommissionBreakdown', () => {
  it('membagi harga sesuai persentase komisi (20%)', () => {
    const result = calculateCommissionBreakdown(100_000, 20);
    expect(result.priceTotal).toBe(100_000);
    expect(result.platformCommission).toBe(20_000);
    expect(result.workerPayout).toBe(80_000);
  });

  it('platformCommission + workerPayout selalu sama dengan priceTotal (tidak ada uang hilang/nambah)', () => {
    const cases = [50_000, 75_500, 123_456.78, 1, 999_999];
    for (const price of cases) {
      const { priceTotal, platformCommission, workerPayout } = calculateCommissionBreakdown(
        price,
        15,
      );
      expect(Math.round((platformCommission + workerPayout) * 100)).toBe(
        Math.round(priceTotal * 100),
      );
    }
  });

  it('membulatkan ke 2 desimal, tidak ada floating point drift', () => {
    const result = calculateCommissionBreakdown(33.33, 15);
    expect(result.platformCommission).toBe(5);
    expect(result.workerPayout).toBe(28.33);
  });

  it('komisi 0% berarti semua masuk ke worker', () => {
    const result = calculateCommissionBreakdown(100_000, 0);
    expect(result.platformCommission).toBe(0);
    expect(result.workerPayout).toBe(100_000);
  });

  it('komisi 100% berarti semua masuk ke platform', () => {
    const result = calculateCommissionBreakdown(100_000, 100);
    expect(result.platformCommission).toBe(100_000);
    expect(result.workerPayout).toBe(0);
  });

  it('menolak priceTotal negatif', () => {
    expect(() => calculateCommissionBreakdown(-1, 20)).toThrow('priceTotal tidak boleh negatif');
  });

  it('menolak commissionPercent di luar 0-100', () => {
    expect(() => calculateCommissionBreakdown(100, -5)).toThrow();
    expect(() => calculateCommissionBreakdown(100, 101)).toThrow();
  });
});
