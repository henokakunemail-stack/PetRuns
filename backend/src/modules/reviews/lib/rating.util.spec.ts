import { calculateAverageRating } from './rating.util';

describe('calculateAverageRating', () => {
  it('mengembalikan 0 kalau belum ada review', () => {
    expect(calculateAverageRating([])).toBe(0);
  });

  it('mengembalikan rating itu sendiri kalau hanya ada 1 review', () => {
    expect(calculateAverageRating([4])).toBe(4);
  });

  it('menghitung rata-rata & membulatkan ke 2 desimal', () => {
    expect(calculateAverageRating([5, 4, 4])).toBe(4.33);
  });

  it('menghitung rata-rata dari banyak review', () => {
    expect(calculateAverageRating([5, 5, 5, 1])).toBe(4);
  });
});
