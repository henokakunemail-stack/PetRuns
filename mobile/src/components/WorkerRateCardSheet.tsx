import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import type { WorkerCardProfile } from '../../backend/src/services/geolocation.service';

export interface WorkerRateCardSheetProps {
  worker: WorkerCardProfile | null;
  visible: boolean;
  onClose: () => void;
  onProceedBooking: (worker: WorkerCardProfile, durationMinutes: number) => void;
}

export function formatRupiah(num: number): string {
  return 'Rp ' + num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export const WorkerRateCardSheet: React.FC<WorkerRateCardSheetProps> = ({
  worker,
  visible,
  onClose,
  onProceedBooking,
}) => {
  const { isGuest, openOtpModal } = useAuth();
  const [selectedDuration, setSelectedDuration] = useState<number>(60);

  if (!visible || !worker) return null;

  const durationOptions = [
    { minutes: 30, label: '30 Menit', price: worker.price30m },
    { minutes: 60, label: '60 Menit', price: worker.price60m },
    { minutes: 120, label: '120 Menit', price: worker.price120m },
    { minutes: 1440, label: 'Overnight', price: worker.priceOvernight },
  ];

  const handleBookNow = () => {
    if (isGuest) {
      // Guest mode: prompt OTP login modal first
      openOtpModal(() => {
        onProceedBooking(worker, selectedDuration);
      });
      return;
    }
    // Authenticated: proceed directly
    onProceedBooking(worker, selectedDuration);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.workerName}>{worker.fullName}</Text>
              <View style={styles.ratingRow}>
                <Text style={styles.star}>★</Text>
                <Text style={styles.ratingText}>
                  {worker.ratingAvg.toFixed(1)} ({worker.ratingCount} ulasan)
                </Text>
                {worker.distanceKm !== undefined && (
                  <Text style={styles.distanceText}> • {worker.distanceKm} km dari Anda</Text>
                )}
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body}>
            {/* Bio */}
            {worker.bio && <Text style={styles.bioText}>{worker.bio}</Text>}

            {/* Pet Types Badges */}
            <Text style={styles.sectionTitle}>Menerima Hewan:</Text>
            <View style={styles.tagGroup}>
              {worker.supportedPetTypes.map((type) => (
                <View key={type} style={styles.tagBadge}>
                  <Text style={styles.tagText}>{type.replace('_', ' ')}</Text>
                </View>
              ))}
            </View>

            {/* Duration & Pricing Options */}
            <Text style={styles.sectionTitle}>Pilih Durasi Layanan:</Text>
            <View style={styles.durationGrid}>
              {durationOptions.map((opt) => {
                const isSelected = selectedDuration === opt.minutes;
                return (
                  <TouchableOpacity
                    key={opt.minutes}
                    style={[styles.durationPill, isSelected && styles.durationPillSelected]}
                    onPress={() => setSelectedDuration(opt.minutes)}
                  >
                    <Text style={[styles.durationLabel, isSelected && styles.durationLabelSelected]}>
                      {opt.label}
                    </Text>
                    <Text style={[styles.durationPrice, isSelected && styles.durationPriceSelected]}>
                      {formatRupiah(opt.price)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Action Button */}
          <TouchableOpacity style={styles.ctaButton} onPress={handleBookNow}>
            <Text style={styles.ctaButtonText}>Pesan Sekarang</Text>
          </TouchableOpacity>
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
  sheetContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  workerName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212121',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  star: {
    color: '#fbc02d',
    fontSize: 16,
    marginRight: 4,
  },
  ratingText: {
    fontSize: 14,
    color: '#555',
    fontWeight: '600',
  },
  distanceText: {
    fontSize: 13,
    color: '#777',
  },
  closeButton: {
    padding: 6,
  },
  closeText: {
    fontSize: 18,
    color: '#999',
  },
  body: {
    marginBottom: 16,
  },
  bioText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    marginTop: 4,
  },
  tagGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  tagBadge: {
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 12,
    color: '#2e7d32',
    fontWeight: '500',
  },
  durationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  durationPill: {
    width: '48%',
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  durationPillSelected: {
    borderColor: '#2e7d32',
    backgroundColor: '#f1f8e9',
  },
  durationLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  durationLabelSelected: {
    color: '#2e7d32',
    fontWeight: 'bold',
  },
  durationPrice: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
  },
  durationPriceSelected: {
    color: '#2e7d32',
  },
  ctaButton: {
    backgroundColor: '#2e7d32',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  ctaButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
