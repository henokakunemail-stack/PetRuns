export interface CommissionBreakdown {
  priceTotal: number;
  platformCommission: number;
  workerPayout: number;
}

/**
 * Hitung pembagian antara komisi platform & payout worker dari harga total.
 * commissionPercent contoh: 20 artinya 20%.
 *
 * Dibulatkan ke 2 desimal (Rupiah tidak butuh sen, tapi Decimal(10,2) di schema
 * mendukung 2 desimal — dibulatkan supaya tidak ada floating point drift).
 *
 * Pure function — logic finansial kritikal, wajib punya unit test (lihat CLAUDE.md).
 */
export function calculateCommissionBreakdown(
  priceTotal: number,
  commissionPercent: number,
): CommissionBreakdown {
  if (priceTotal < 0) {
    throw new Error('priceTotal tidak boleh negatif');
  }
  if (commissionPercent < 0 || commissionPercent > 100) {
    throw new Error('commissionPercent harus antara 0 dan 100');
  }

  const platformCommission = round2(priceTotal * (commissionPercent / 100));
  const workerPayout = round2(priceTotal - platformCommission);

  return { priceTotal: round2(priceTotal), platformCommission, workerPayout };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
