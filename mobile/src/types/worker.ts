export interface WorkerCardProfile {
  id: string;
  fullName: string;
  bio: string | null;
  ratingAvg: number;
  ratingCount: number;
  price30m: number;
  price60m: number;
  price120m: number;
  priceOvernight: number;
  supportedPetTypes: string[];
  isOnline: boolean;
  distanceKm?: number;
}
