import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

export interface PendingReviewData {
  bookingId: string;
  workerId: string;
  workerName: string;
  completedAt: string;
}

export interface UsePendingReviewResult {
  pendingReview: PendingReviewData | null;
  isLoading: boolean;
  checkPendingReview: () => Promise<void>;
  clearPendingReview: () => void;
}

export function usePendingReview(apiBaseUrl = 'https://api.petmatch.id'): UsePendingReviewResult {
  const { token, user } = useAuth();
  const [pendingReview, setPendingReview] = useState<PendingReviewData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const checkPendingReview = useCallback(async () => {
    if (!token || user?.role !== 'OWNER') return;

    setIsLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/bookings/pending-review`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = (await res.json()) as PendingReviewData | null;
        setPendingReview(data);
      } else {
        setPendingReview(null);
      }
    } catch {
      setPendingReview(null);
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, token, user]);

  useEffect(() => {
    void checkPendingReview();
  }, [checkPendingReview]);

  const clearPendingReview = useCallback(() => {
    setPendingReview(null);
  }, []);

  return {
    pendingReview,
    isLoading,
    checkPendingReview,
    clearPendingReview,
  };
}
