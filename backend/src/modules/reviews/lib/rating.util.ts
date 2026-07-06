/**
 * Hitung rata-rata rating worker dari seluruh review-nya.
 * Dibulatkan ke 2 desimal untuk cocok dengan kolom Decimal(3,2) di schema.
 * Pure function — wajib unit test karena dipakai untuk ranking pencarian worker.
 */
export function calculateAverageRating(ratings: number[]): number {
  if (ratings.length === 0) {
    return 0;
  }
  const sum = ratings.reduce((total, rating) => total + rating, 0);
  return Math.round((sum / ratings.length) * 100) / 100;
}
