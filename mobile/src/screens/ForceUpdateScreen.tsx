import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Dimensions,
} from 'react-native';

const { width } = Dimensions.get('window');

export interface ForceUpdateScreenProps {
  currentVersion: string;
  minVersion: string;
  storeUrl: string;
  releaseNotes?: string;
}

export const ForceUpdateScreen: React.FC<ForceUpdateScreenProps> = ({
  currentVersion,
  minVersion,
  storeUrl,
  releaseNotes,
}) => {
  const handleOpenStore = () => {
    void Linking.openURL(storeUrl);
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Text style={styles.iconEmoji}>🚀</Text>
        </View>

        <Text style={styles.title}>Pembaruan Aplikasi Wajib</Text>
        <Text style={styles.subtitle}>
          Versi aplikasi yang Anda gunakan ({currentVersion}) sudah tidak didukung. Silakan perbarui ke versi minimal {minVersion} untuk melanjutkan.
        </Text>

        {releaseNotes && (
          <View style={styles.notesBox}>
            <Text style={styles.notesTitle}>Catatan Pembaruan:</Text>
            <Text style={styles.notesText}>{releaseNotes}</Text>
          </View>
        )}

        <TouchableOpacity style={styles.updateButton} onPress={handleOpenStore}>
          <Text style={styles.updateButtonText}>Perbarui Sekarang di Store</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    width: '100%',
    alignItems: 'center',
  },
  iconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  iconEmoji: {
    fontSize: 44,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  notesBox: {
    width: '100%',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 28,
  },
  notesTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#555',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 13,
    color: '#333',
    lineHeight: 18,
  },
  updateButton: {
    width: '100%',
    backgroundColor: '#2e7d32',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 3,
  },
  updateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
