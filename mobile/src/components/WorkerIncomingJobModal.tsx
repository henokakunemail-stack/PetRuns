import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

export interface IncomingJobData {
  bookingId: string;
  petName: string;
  serviceType: string;
  durationMinutes: number;
  workerPayout: number;
  pickupAddress: string;
}

export interface WorkerIncomingJobModalProps {
  job: IncomingJobData | null;
  visible: boolean;
  apiBaseUrl?: string;
  authToken?: string;
  onAccepted: (bookingId: string) => void;
  onDismissed: () => void;
}

export function formatRupiah(num: number): string {
  return 'Rp ' + num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export const WorkerIncomingJobModal: React.FC<WorkerIncomingJobModalProps> = ({
  job,
  visible,
  apiBaseUrl = 'https://api.petmatch.id',
  authToken,
  onAccepted,
  onDismissed,
}) => {
  const [countdown, setCountdown] = useState<number>(45);
  const [isResponding, setIsResponding] = useState<boolean>(false);

  useEffect(() => {
    let timer: number | undefined;
    if (visible && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (visible && countdown <= 0) {
      // Auto-reject on timeout
      void handleRespond('REJECT');
    }

    return () => {
      clearInterval(timer);
    };
  }, [visible, countdown]);

  if (!visible || !job) return null;

  const handleRespond = async (action: 'ACCEPT' | 'REJECT') => {
    if (isResponding) return;
    setIsResponding(true);

    try {
      const res = await fetch(`${apiBaseUrl}/bookings/${job.bookingId}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ action }),
      });

      if (action === 'ACCEPT' && res.ok) {
        onAccepted(job.bookingId);
      } else {
        onDismissed();
      }
    } catch {
      onDismissed();
    } finally {
      setIsResponding(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Audio Indicator */}
          <View style={styles.soundBadge}>
            <Text style={styles.soundText}>🔔 Permintaan Masuk (alert_dispatch.wav)</Text>
          </View>

          {/* Countdown Ring */}
          <View style={styles.timerCircle}>
            <Text style={styles.timerNumber}>{countdown}</Text>
            <Text style={styles.timerUnit}>detik</Text>
          </View>

          {/* Job Details */}
          <Text style={styles.payoutValue}>{formatRupiah(job.workerPayout)}</Text>
          <Text style={styles.payoutLabel}>Pendapatan Bersih Anda</Text>

          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Hewan:</Text>
              <Text style={styles.detailValue}>{job.petName}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Layanan:</Text>
              <Text style={styles.detailValue}>
                {job.serviceType} • {job.durationMinutes} Menit
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Lokasi Jemput:</Text>
              <Text style={styles.detailValue}>{job.pickupAddress}</Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.rejectButton, isResponding && styles.disabledButton]}
              onPress={() => handleRespond('REJECT')}
              disabled={isResponding}
            >
              <Text style={styles.rejectButtonText}>Tolak</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.acceptButton, isResponding && styles.disabledButton]}
              onPress={() => handleRespond('ACCEPT')}
              disabled={isResponding}
            >
              {isResponding ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.acceptButtonText}>Terima Order</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  soundBadge: {
    backgroundColor: '#fff3e0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 20,
  },
  soundText: {
    color: '#e65100',
    fontSize: 12,
    fontWeight: 'bold',
  },
  timerCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 5,
    borderColor: '#2e7d32',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  timerNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2e7d32',
  },
  timerUnit: {
    fontSize: 11,
    color: '#666',
  },
  payoutValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#212121',
  },
  payoutLabel: {
    fontSize: 13,
    color: '#777',
    marginBottom: 20,
  },
  detailCard: {
    width: '100%',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 13,
    color: '#666',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  rejectButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#eeeeee',
    alignItems: 'center',
  },
  rejectButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#616161',
  },
  acceptButton: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#2e7d32',
    alignItems: 'center',
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  disabledButton: {
    opacity: 0.6,
  },
});
