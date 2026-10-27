import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';

export interface WorkerJobCompletionScreenProps {
  bookingId: string;
  petName: string;
  durationMinutes: number;
  distanceKm: number;
  workerPayout: number;
  apiBaseUrl?: string;
  authToken?: string;
  onFinishJob: () => void;
}

export function formatRupiah(num: number): string {
  return 'Rp ' + num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export const WorkerJobCompletionScreen: React.FC<WorkerJobCompletionScreenProps> = ({
  bookingId,
  petName,
  durationMinutes,
  distanceKm,
  workerPayout,
  apiBaseUrl = 'https://api.petmatch.id',
  authToken,
  onFinishJob,
}) => {
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleCompleteJob = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`${apiBaseUrl}/bookings/${bookingId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        throw new Error(err.message || 'Gagal menyelesaikan order');
      }

      Alert.alert('Selesai!', 'Order berhasil diselesaikan dan dana telah dicatat ke saldo Anda.', [
        {
          text: 'Kembali Standby',
          onPress: onFinishJob,
        },
      ]);
    } catch (err) {
      Alert.alert('Kesalahan', err instanceof Error ? err.message : 'Terjadi kegagalan');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header Trophy */}
      <View style={styles.header}>
        <View style={styles.trophyCircle}>
          <Text style={styles.trophyEmoji}>🎉</Text>
        </View>
        <Text style={styles.title}>Sesi Jalan Selesai!</Text>
        <Text style={styles.subtitle}>Terima kasih telah merawat {petName} dengan baik.</Text>
      </View>

      {/* Earnings Highlight */}
      <View style={styles.earningsCard}>
        <Text style={styles.earningsLabel}>Pendapatan Bersih Anda</Text>
        <Text style={styles.earningsAmount}>{formatRupiah(workerPayout)}</Text>
        <Text style={styles.earningsSub}>Otomatis ditransfer ke saldo dompet worker</Text>
      </View>

      {/* Stats Summary */}
      <View style={styles.statsCard}>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Durasi Jalan</Text>
          <Text style={styles.statValue}>{durationMinutes} Menit</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Total Jarak Ditempuh</Text>
          <Text style={styles.statValue}>{distanceKm.toFixed(2)} km</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Status Akun Setelah Ini</Text>
          <Text style={[styles.statValue, styles.statusOnline]}>Online (Standby)</Text>
        </View>
      </View>

      {/* Finish CTA */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.finishButton, isSubmitting && styles.disabledButton]}
          onPress={handleCompleteJob}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.finishButtonText}>Selesaikan & Standby Kembali</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 24,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
  },
  trophyCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  trophyEmoji: {
    fontSize: 36,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  earningsCard: {
    backgroundColor: '#2e7d32',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginVertical: 20,
    elevation: 3,
  },
  earningsLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '600',
  },
  earningsAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginVertical: 8,
  },
  earningsSub: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
  },
  statsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    elevation: 2,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#222',
  },
  statusOnline: {
    color: '#2e7d32',
  },
  footer: {
    marginBottom: 20,
  },
  finishButton: {
    backgroundColor: '#2e7d32',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  finishButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.6,
  },
});
