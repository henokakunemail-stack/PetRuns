import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

export interface AccountSettingsScreenProps {
  apiBaseUrl?: string;
}

export const AccountSettingsScreen: React.FC<AccountSettingsScreenProps> = ({
  apiBaseUrl = 'https://api.petmatch.id',
}) => {
  const { user, token, logout } = useAuth();
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Apple Guideline 5.1.1(v) compliant deletion alert
  const promptDeleteConfirmation = () => {
    Alert.alert(
      'Hapus Akun Permanen?',
      'Tindakan ini tidak dapat dibatalkan. Seluruh data profil, histori pemesanan, dan identitas Anda akan dihapus secara permanen dari server kami.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Hapus Akun',
          style: 'destructive',
          onPress: executeAccountDeletion,
        },
      ],
      { cancelable: true }
    );
  };

  const executeAccountDeletion = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`${apiBaseUrl}/users/me`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ confirmDeletion: true }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        throw new Error(err.message || 'Gagal menghapus akun');
      }

      Alert.alert(
        'Akun Berhasil Dihapus',
        'Data pribadi Anda telah dihapus. Anda akan dialihkan ke layar utama sebagai tamu.',
        [
          {
            text: 'OK',
            onPress: async () => {
              await logout();
            },
          },
        ]
      );
    } catch (err) {
      Alert.alert('Gagal Menghapus Akun', err instanceof Error ? err.message : 'Terjadi kesalahan sistem');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Pengaturan Akun</Text>

      {/* Profile Card */}
      <View style={styles.card}>
        <Text style={styles.label}>Nama Pengguna</Text>
        <Text style={styles.value}>{user?.fullName || 'Pet Owner'}</Text>

        <Text style={styles.label}>Nomor Telepon</Text>
        <Text style={styles.value}>{user?.phone || '-'}</Text>

        <Text style={styles.label}>Peran Akun</Text>
        <Text style={styles.value}>{user?.role || 'OWNER'}</Text>
      </View>

      {/* Account Actions */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutButtonText}>Keluar dari Akun</Text>
        </TouchableOpacity>
      </View>

      {/* Apple Guideline 5.1.1(v) Account Deletion Section */}
      <View style={styles.dangerZone}>
        <Text style={styles.dangerTitle}>Zona Berbahaya</Text>
        <Text style={styles.dangerDesc}>
          Sesuai ketentuan privasi Apple App Store Guideline 5.1.1(v), Anda berhak menghapus akun beserta seluruh data pribadi kapan saja.
        </Text>

        <TouchableOpacity
          style={[styles.deleteButton, isDeleting && styles.buttonDisabled]}
          onPress={promptDeleteConfirmation}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.deleteButtonText}>Hapus Akun Saya Permanen</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    padding: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#eee',
  },
  label: {
    fontSize: 12,
    color: '#888',
    marginTop: 8,
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
  },
  section: {
    marginBottom: 24,
  },
  logoutButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#444',
    fontSize: 15,
    fontWeight: '600',
  },
  dangerZone: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ffcdd2',
    marginBottom: 40,
  },
  dangerTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#d32f2f',
    marginBottom: 6,
  },
  dangerDesc: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginBottom: 16,
  },
  deleteButton: {
    backgroundColor: '#d32f2f',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
