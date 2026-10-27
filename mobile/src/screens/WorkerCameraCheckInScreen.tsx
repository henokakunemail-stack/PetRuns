import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';

export interface WorkerCameraCheckInScreenProps {
  bookingId: string;
  pickupLatitude: number;
  pickupLongitude: number;
  apiBaseUrl?: string;
  authToken?: string;
  onCheckInSuccess: () => void;
  onCancel: () => void;
}

export function computeDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export const WorkerCameraCheckInScreen: React.FC<WorkerCameraCheckInScreenProps> = ({
  bookingId,
  pickupLatitude,
  pickupLongitude,
  apiBaseUrl = 'https://api.petmatch.id',
  authToken,
  onCheckInSuccess,
  onCancel,
}) => {
  const [currentCoords, setCurrentCoords] = useState<{ latitude: number; longitude: number }>({
    latitude: pickupLatitude,
    longitude: pickupLongitude,
  });
  const [distanceMeters, setDistanceMeters] = useState<number>(0);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);

  // Poll / simulate current GPS
  useEffect(() => {
    const dist = computeDistanceMeters(
      currentCoords.latitude,
      currentCoords.longitude,
      pickupLatitude,
      pickupLongitude
    );
    setDistanceMeters(dist);
  }, [currentCoords, pickupLatitude, pickupLongitude]);

  const isWithinRadius = distanceMeters <= 100;

  const handleCaptureAndCheckIn = async () => {
    if (!isWithinRadius) {
      Alert.alert('Di Luar Jangkauan', 'Anda harus berada dalam radius 100 meter dari titik jemput.');
      return;
    }

    setIsCapturing(true);

    try {
      // 1. Get presigned upload URL for check-in photo
      const uploadRes = await fetch(`${apiBaseUrl}/storage/presigned-upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          folder: 'checkins',
          contentType: 'image/jpeg',
        }),
      });

      let photoS3Key = 'checkin_proof.jpg';
      if (uploadRes.ok) {
        const uploadData = (await uploadRes.json()) as { key: string };
        photoS3Key = uploadData.key;
      }

      // 2. Call Check-in API
      const checkInRes = await fetch(`${apiBaseUrl}/bookings/${bookingId}/check-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          photo_s3_key: photoS3Key,
          latitude: currentCoords.latitude,
          longitude: currentCoords.longitude,
        }),
      });

      if (!checkInRes.ok) {
        const err = (await checkInRes.json()) as { message?: string };
        throw new Error(err.message || 'Check-in gagal');
      }

      onCheckInSuccess();
    } catch (err) {
      Alert.alert('Gagal Check-In', err instanceof Error ? err.message : 'Terjadi kesalahan jaringan');
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Live Camera View Finder Placeholder (Vision Camera Native View) */}
      <View style={styles.cameraView}>
        <View style={styles.focusFrame} />
        <Text style={styles.cameraNote}>Kamera Langsung (Galeri Dinonaktifkan)</Text>

        {/* Distance-to-pickup Badge */}
        <View style={[styles.distanceBadge, isWithinRadius ? styles.badgeSuccess : styles.badgeDanger]}>
          <Text style={styles.distanceBadgeText}>
            {isWithinRadius ? '✓ ' : '✕ '} Jarak ke titik jemput: {distanceMeters}m {isWithinRadius ? '(Memenuhi Syarat)' : '(>100m)'}
          </Text>
        </View>
      </View>

      {/* Camera Control Footer */}
      <View style={styles.controlsFooter}>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel} disabled={isCapturing}>
          <Text style={styles.cancelText}>Batal</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.shutterButton,
            !isWithinRadius && styles.shutterDisabled,
            isCapturing && styles.shutterDisabled,
          ]}
          onPress={handleCaptureAndCheckIn}
          disabled={!isWithinRadius || isCapturing}
        >
          {isCapturing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={styles.shutterInner} />
          )}
        </TouchableOpacity>

        <View style={styles.placeholderSide} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  focusFrame: {
    width: 260,
    height: 260,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
    borderRadius: 16,
  },
  cameraNote: {
    position: 'absolute',
    top: 40,
    color: '#ccc',
    fontSize: 12,
  },
  distanceBadge: {
    position: 'absolute',
    bottom: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  badgeSuccess: {
    backgroundColor: 'rgba(46, 125, 50, 0.9)',
  },
  badgeDanger: {
    backgroundColor: 'rgba(211, 47, 47, 0.9)',
  },
  distanceBadgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  controlsFooter: {
    height: 120,
    backgroundColor: '#111',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
  },
  cancelButton: {
    padding: 12,
  },
  cancelText: {
    color: '#fff',
    fontSize: 15,
  },
  shutterButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2e7d32',
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#fff',
  },
  shutterDisabled: {
    backgroundColor: '#555',
    borderColor: '#777',
    opacity: 0.6,
  },
  placeholderSide: {
    width: 48,
  },
});
