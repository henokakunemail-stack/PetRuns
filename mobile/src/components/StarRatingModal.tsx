import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import type { PendingReviewData } from '../hooks/usePendingReview';

export interface StarRatingModalProps {
  pendingReview: PendingReviewData | null;
  visible: boolean;
  apiBaseUrl?: string;
  onSubmitSuccess: () => void;
}

export const StarRatingModal: React.FC<StarRatingModalProps> = ({
  pendingReview,
  visible,
  apiBaseUrl = 'https://api.petmatch.id',
  onSubmitSuccess,
}) => {
  const { token } = useAuth();
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!visible || !pendingReview) return null;

  const handleSubmit = async () => {
    if (rating < 1 || rating > 5) {
      Alert.alert('Perhatian', 'Silakan pilih bintang penilaian minimal 1 bintang.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${apiBaseUrl}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bookingId: pendingReview.bookingId,
          score: rating,
          comment: comment.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        throw new Error(err.message || 'Gagal mengirim ulasan');
      }

      Alert.alert('Terima Kasih!', 'Ulasan dan bintang Anda berhasil disimpan.');
      onSubmitSuccess();
    } catch (err) {
      Alert.alert('Kesalahan', err instanceof Error ? err.message : 'Terjadi kegagalan');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Beri Ulasan Layanan</Text>
          <Text style={styles.subtitle}>
            Bagaimana pengalaman jalan hewan Anda bersama {pendingReview.workerName}?
          </Text>

          {/* 5-Star Selector */}
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => setRating(star)}
                activeOpacity={0.7}
                style={styles.starTouch}
              >
                <Text style={[styles.starIcon, star <= rating ? styles.starFilled : styles.starEmpty]}>
                  ★
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.ratingLabel}>
            {rating === 0
              ? 'Pilih bintang penilaian'
              : rating === 5
              ? 'Sangat Puas! ⭐⭐⭐⭐⭐'
              : rating >= 4
              ? 'Bagus & Memuaskan ⭐⭐⭐⭐'
              : rating >= 3
              ? 'Cukup Baik ⭐⭐⭐'
              : 'Perlu Ditingkatkan'}
          </Text>

          {/* Comment Input */}
          <TextInput
            style={styles.commentInput}
            placeholder="Tulis ulasan pengalaman Anda (opsional)..."
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            value={comment}
            onChangeText={setComment}
            maxLength={500}
          />

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, (rating < 1 || isSubmitting) && styles.submitDisabled]}
            onPress={handleSubmit}
            disabled={rating < 1 || isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>Kirim Ulasan & Buka Aplikasi</Text>
            )}
          </TouchableOpacity>
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
    padding: 24,
  },
  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 8,
  },
  starTouch: {
    padding: 8,
  },
  starIcon: {
    fontSize: 40,
  },
  starFilled: {
    color: '#ffb300',
  },
  starEmpty: {
    color: '#e0e0e0',
  },
  ratingLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    marginBottom: 16,
  },
  commentInput: {
    width: '100%',
    height: 100,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    textAlignVertical: 'top',
    marginBottom: 20,
    backgroundColor: '#fafafa',
  },
  submitButton: {
    width: '100%',
    backgroundColor: '#2e7d32',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitDisabled: {
    backgroundColor: '#a5d6a7',
  },
  submitText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
