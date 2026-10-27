import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import type { WorkerCardProfile } from '../types/worker';

export interface OwnerCheckoutModalProps {
  worker: WorkerCardProfile | null;
  durationMinutes: number;
  visible: boolean;
  apiBaseUrl?: string;
  onClose: () => void;
  onMatchSuccess: (bookingId: string) => void;
}

export function formatRupiah(num: number): string {
  return 'Rp ' + num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const OwnerCheckoutModal: React.FC<OwnerCheckoutModalProps> = ({
  worker,
  durationMinutes,
  visible,
  apiBaseUrl = 'https://api.petmatch.id',
  onClose,
  onMatchSuccess,
}) => {
  const { token, user } = useAuth();
  const [isMatching, setIsMatching] = useState<boolean>(false);
  const [radarCountdown, setRadarCountdown] = useState<number>(45);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let timer: number | undefined;
    if (isMatching && radarCountdown > 0) {
      timer = setInterval(() => {
        setRadarCountdown((prev) => prev - 1);
      }, 1000);
    } else if (isMatching && radarCountdown <= 0) {
      // Timeout
      setIsMatching(false);
      setErrorMessage('Worker tidak merespons dalam 45 detik. Dana hold telah dilepas.');
    }

    return () => {
      clearInterval(timer);
    };
  }, [isMatching, radarCountdown]);

  if (!visible || !worker) return null;

  // Rate lookup
  const getBaseRate = (): number => {
    switch (durationMinutes) {
      case 30:
        return worker.price30m;
      case 60:
        return worker.price60m;
      case 120:
        return worker.price120m;
      default:
        return worker.priceOvernight;
    }
  };

  const grossAmount = getBaseRate();
  const commissionAmount = Math.round(grossAmount * 0.15);
  const workerPayout = grossAmount - commissionAmount;

  const handleStartInstantMatch = async () => {
    if (!token || !user) return;
    setErrorMessage(null);
    setIsMatching(true);
    setRadarCountdown(45);

    const idempotencyKey = generateUUID();

    try {
      const res = await fetch(`${apiBaseUrl}/bookings/instant-match`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ownerId: user.id,
          workerId: worker.id,
          petId: 'pet-default-uuid',
          serviceType: 'WALK',
          durationMinutes,
          grossAmount,
          pickupLongitude: 106.8456,
          pickupLatitude: -6.2088,
          idempotencyKey,
        }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        throw new Error(err.message || 'Gagal memproses pre-otorisasi pembayaran');
      }

      const data = (await res.json()) as { id: string };
      setBookingId(data.id);
    } catch (err) {
      setIsMatching(false);
      setErrorMessage(err instanceof Error ? err.message : 'Terjadi kegagalan order');
    }
  };

  const handleCancelMatch = () => {
    setIsMatching(false);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {!isMatching ? (
            <>
              <Text style={styles.title}>Rincian Pembayaran</Text>
              <Text style={styles.subtitle}>
                Biaya ditahan (pre-auth escrow hold) dan baru ditagihkan saat order selesai.
              </Text>

              {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

              <View style={styles.breakdownCard}>
                <View style={styles.breakdownRow}>
                  <Text style={styles.rowLabel}>Worker Terpilih</Text>
                  <Text style={styles.rowValue}>{worker.fullName}</Text>
                </View>
                <View style={styles.breakdownRow}>
                  <Text style={styles.rowLabel}>Durasi Sesi</Text>
                  <Text style={styles.rowValue}>{durationMinutes} Menit</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.breakdownRow}>
                  <Text style={styles.rowLabel}>Tarif Jasa Worker (85%)</Text>
                  <Text style={styles.rowValue}>{formatRupiah(workerPayout)}</Text>
                </View>
                <View style={styles.breakdownRow}>
                  <Text style={styles.rowLabel}>Biaya Layanan Platform (15%)</Text>
                  <Text style={styles.rowValue}>{formatRupiah(commissionAmount)}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.breakdownRow}>
                  <Text style={styles.totalLabel}>Total Ditahan (Escrow Hold)</Text>
                  <Text style={styles.totalValue}>{formatRupiah(grossAmount)}</Text>
                </View>
              </View>

              <TouchableOpacity style={styles.payButton} onPress={handleStartInstantMatch}>
                <Text style={styles.payButtonText}>Otorisasi Pembayaran & Cari Worker</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelButtonText}>Kembali</Text>
              </TouchableOpacity>
            </>
          ) : (
            /* Radar Searching 45s Countdown */
            <View style={styles.radarContainer}>
              <View style={styles.radarCircle}>
                <ActivityIndicator size="large" color="#2e7d32" />
                <Text style={styles.radarTimer}>{radarCountdown}s</Text>
              </View>
              <Text style={styles.radarTitle}>Menghubungi {worker.fullName}...</Text>
              <Text style={styles.radarSubtitle}>
                Worker memiliki waktu 45 detik untuk menerima order. Dana tetap aman di escrow.
              </Text>

              <TouchableOpacity style={styles.cancelRadarButton} onPress={handleCancelMatch}>
                <Text style={styles.cancelRadarText}>Batalkan Pencarian</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
  },
  errorText: {
    color: '#d32f2f',
    marginBottom: 12,
    fontSize: 13,
  },
  breakdownCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  rowLabel: {
    fontSize: 14,
    color: '#555',
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#222',
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 8,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#212121',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2e7d32',
  },
  payButton: {
    backgroundColor: '#2e7d32',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  payButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  cancelButtonText: {
    color: '#777',
    fontSize: 14,
  },
  radarContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  radarCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  radarTimer: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginTop: 8,
  },
  radarTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: 6,
  },
  radarSubtitle: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  cancelRadarButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  cancelRadarText: {
    color: '#666',
    fontWeight: '600',
  },
});
