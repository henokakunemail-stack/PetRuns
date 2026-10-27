import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

export const PhoneOtpModal: React.FC = () => {
  const { isOtpModalVisible, closeOtpModal, requestOtp, verifyOtp } = useAuth();

  const [phone, setPhone] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [step, setStep] = useState<'PHONE' | 'OTP'>('PHONE');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(300);

  useEffect(() => {
    let timer: number | undefined;
    if (step === 'OTP' && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      clearInterval(timer);
    };
  }, [step, countdown]);

  if (!isOtpModalVisible) return null;

  const handleSendOtp = async () => {
    setError(null);
    if (!phone || phone.trim().length < 8) {
      setError('Masukkan nomor handphone yang valid');
      return;
    }

    setLoading(true);
    const success = await requestOtp(phone.trim());
    setLoading(false);

    if (success) {
      setStep('OTP');
      setCountdown(300);
    } else {
      setError('Gagal mengirim kode OTP. Coba lagi nanti.');
    }
  };

  const handleVerifyOtp = async () => {
    setError(null);
    if (!code || code.trim().length !== 6) {
      setError('Masukkan 6-digit kode OTP');
      return;
    }

    setLoading(true);
    const success = await verifyOtp(phone.trim(), code.trim());
    setLoading(false);

    if (!success) {
      setError('Kode OTP salah atau kadaluarsa');
    }
  };

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <Modal visible={isOtpModalVisible} transparent animationType="slide" onRequestClose={closeOtpModal}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>
            {step === 'PHONE' ? 'Masuk / Daftar' : 'Verifikasi Kode OTP'}
          </Text>
          <Text style={styles.subtitle}>
            {step === 'PHONE'
              ? 'Lanjutkan booking dengan verifikasi nomor telepon'
              : `Kode verifikasi telah dikirim ke ${phone}`}
          </Text>

          {error && <Text style={styles.errorText}>{error}</Text>}

          {step === 'PHONE' ? (
            <>
              <TextInput
                style={styles.input}
                placeholder="Contoh: 081234567890"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                autoFocus
              />
              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleSendOtp}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Kirim Kode OTP</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TextInput
                style={[styles.input, styles.otpInput]}
                placeholder="6-digit PIN"
                keyboardType="number-pad"
                maxLength={6}
                value={code}
                onChangeText={setCode}
                autoFocus
              />
              <Text style={styles.countdownText}>
                {countdown > 0 ? `Kirim ulang dalam ${formatCountdown(countdown)}` : 'Kode kadaluarsa'}
              </Text>
              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleVerifyOtp}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Verifikasi & Masuk</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={styles.cancelButton} onPress={closeOtpModal}>
            <Text style={styles.cancelButtonText}>Batal</Text>
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
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  errorText: {
    color: '#e53935',
    fontSize: 13,
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  otpInput: {
    textAlign: 'center',
    letterSpacing: 8,
    fontSize: 24,
    fontWeight: 'bold',
  },
  countdownText: {
    textAlign: 'center',
    color: '#888',
    marginBottom: 16,
    fontSize: 13,
  },
  button: {
    backgroundColor: '#2e7d32',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  cancelButton: {
    alignItems: 'center',
    padding: 8,
  },
  cancelButtonText: {
    color: '#777',
    fontSize: 14,
  },
});
