import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Switch,
} from 'react-native';

export type KycStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface WorkerKycScreenProps {
  workerId: string;
  apiBaseUrl?: string;
  initialStatus?: KycStatus;
}

export const WorkerKycScreen: React.FC<WorkerKycScreenProps> = ({
  workerId,
  apiBaseUrl = 'https://api.petmatch.id',
  initialStatus = 'PENDING',
}) => {
  const [verificationStatus, setVerificationStatus] = useState<KycStatus>(initialStatus);
  const [ktpCaptured, setKtpCaptured] = useState<boolean>(false);
  const [selfieCaptured, setSelfieCaptured] = useState<boolean>(false);
  const [skckPicked, setSkckPicked] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 1. Capture actions (in native production, calls camera / document picker)
  const handleCaptureKtp = () => {
    setKtpCaptured(true);
  };

  const handleCaptureSelfie = () => {
    setSelfieCaptured(true);
  };

  const handlePickSkck = () => {
    setSkckPicked(true);
  };

  // 2. Submit KYC pipeline: get presigned URLs, upload to S3, trigger backend verify
  const handleSubmitKyc = async () => {
    if (!ktpCaptured || !selfieCaptured || !skckPicked) {
      Alert.alert('Perhatian', 'Mohon lengkapi foto KTP, selfie, dan file SKCK');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // Fetch Presigned URLs
      const [ktpPresignRes, selfiePresignRes, skckPresignRes] = await Promise.all([
        fetch(`${apiBaseUrl}/workers/kyc/upload-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workerId, docType: 'ktp', contentType: 'image/jpeg' }),
        }),
        fetch(`${apiBaseUrl}/workers/kyc/upload-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workerId, docType: 'selfie', contentType: 'image/jpeg' }),
        }),
        fetch(`${apiBaseUrl}/workers/kyc/upload-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workerId, docType: 'skck', contentType: 'application/pdf' }),
        }),
      ]);

      if (!ktpPresignRes.ok || !selfiePresignRes.ok || !skckPresignRes.ok) {
        throw new Error('Gagal mendapatkan upload URL untuk dokumen KYC');
      }

      const ktpData = (await ktpPresignRes.json()) as { url: string; key: string };
      const selfieData = (await selfiePresignRes.json()) as { url: string; key: string };
      const skckData = (await skckPresignRes.json()) as { url: string; key: string };

      // In production: upload binary to S3 using presigned PUT URL
      // await fetch(ktpData.url, { method: 'PUT', body: ktpBlob, headers: ktpHeaders });

      // Call verification endpoint
      const verifyRes = await fetch(`${apiBaseUrl}/workers/kyc/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerId,
          ktpS3Key: ktpData.key,
          selfieS3Key: selfieData.key,
          skckS3Key: skckData.key,
        }),
      });

      const verifyData = (await verifyRes.json()) as {
        verificationStatus: KycStatus;
        message: string;
      };

      setVerificationStatus(verifyData.verificationStatus);
      if (verifyData.verificationStatus === 'VERIFIED') {
        Alert.alert('Sukses', 'Identitas worker berhasil diverifikasi! Anda kini dapat menerima booking.');
      } else {
        setErrorMessage(verifyData.message || 'Verifikasi biometrik gagal. Silakan coba lagi.');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Terjadi kesalahan pada verifikasi');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Online toggle: Strictly blocked if verification_status !== 'VERIFIED'
  const handleToggleOnline = (value: boolean) => {
    if (value && verificationStatus !== 'VERIFIED') {
      Alert.alert(
        'Akun Belum Terverifikasi',
        'Anda harus menyelesaikan verifikasi KTP dan biometrik sebelum dapat mengaktifkan status online.'
      );
      setIsOnline(false);
      return;
    }
    setIsOnline(value);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Verifikasi Identitas Worker</Text>
      <Text style={styles.description}>
        Sesuai regulasi keamanan platform, worker wajib memverifikasi KTP, foto selfie, dan SKCK resmi.
      </Text>

      {/* Status Banner */}
      <View
        style={[
          styles.statusBanner,
          verificationStatus === 'VERIFIED'
            ? styles.statusVerified
            : verificationStatus === 'REJECTED'
              ? styles.statusRejected
              : styles.statusPending,
        ]}
      >
        <Text style={styles.statusText}>
          Status: {verificationStatus === 'VERIFIED' ? 'TERVERIFIKASI' : verificationStatus === 'REJECTED' ? 'DITOLAK' : 'MENUNGGU VERIFIKASI'}
        </Text>
      </View>

      {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

      {/* Document Capture List */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>1. Foto KTP Asli</Text>
        <TouchableOpacity
          style={[styles.actionButton, ktpCaptured && styles.actionButtonDone]}
          onPress={handleCaptureKtp}
        >
          <Text style={styles.actionButtonText}>
            {ktpCaptured ? '✓ KTP Terfoto (Ambil Ulang)' : 'Ambil Foto KTP'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>2. Foto Selfie Liveness</Text>
        <TouchableOpacity
          style={[styles.actionButton, selfieCaptured && styles.actionButtonDone]}
          onPress={handleCaptureSelfie}
        >
          <Text style={styles.actionButtonText}>
            {selfieCaptured ? '✓ Selfie Terfoto (Ambil Ulang)' : 'Ambil Foto Selfie'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>3. Dokumen SKCK (PDF / Gambar)</Text>
        <TouchableOpacity
          style={[styles.actionButton, skckPicked && styles.actionButtonDone]}
          onPress={handlePickSkck}
        >
          <Text style={styles.actionButtonText}>
            {skckPicked ? '✓ File SKCK Terpilih (Ganti)' : 'Pilih File SKCK'}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.submitButton, isSubmitting && styles.buttonDisabled]}
        onPress={handleSubmitKyc}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitButtonText}>Kirim Verifikasi KYC</Text>
        )}
      </TouchableOpacity>

      {/* Online Status Toggle with Verification Gate */}
      <View style={styles.onlineSection}>
        <View style={styles.onlineTextGroup}>
          <Text style={styles.onlineTitle}>Status Online</Text>
          <Text style={styles.onlineSubtitle}>
            {isOnline ? 'Menerima order booking sekitar' : 'Tidak aktif menerima order'}
          </Text>
        </View>
        <Switch
          value={isOnline}
          onValueChange={handleToggleOnline}
          trackColor={{ false: '#ccc', true: '#2e7d32' }}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: 6,
  },
  description: {
    fontSize: 14,
    color: '#616161',
    marginBottom: 16,
    lineHeight: 20,
  },
  statusBanner: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  statusPending: {
    backgroundColor: '#fff3e0',
  },
  statusVerified: {
    backgroundColor: '#e8f5e9',
  },
  statusRejected: {
    backgroundColor: '#ffebee',
  },
  statusText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  errorText: {
    color: '#d32f2f',
    marginBottom: 12,
    fontSize: 13,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  actionButton: {
    backgroundColor: '#1976d2',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  actionButtonDone: {
    backgroundColor: '#388e3c',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  submitButton: {
    backgroundColor: '#2e7d32',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  onlineSection: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  onlineTextGroup: {
    flex: 1,
  },
  onlineTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#212121',
  },
  onlineSubtitle: {
    fontSize: 13,
    color: '#757575',
    marginTop: 2,
  },
});
