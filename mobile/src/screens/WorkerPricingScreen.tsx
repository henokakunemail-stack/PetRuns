import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';

export const PET_TYPE_OPTIONS = [
  { key: 'DOG_SMALL', label: 'Anjing Kecil (<10kg)' },
  { key: 'DOG_MEDIUM', label: 'Anjing Sedang (10-25kg)' },
  { key: 'DOG_LARGE', label: 'Anjing Besar (>25kg)' },
  { key: 'CAT', label: 'Kucing' },
  { key: 'OTHER', label: 'Lainnya' },
] as const;

export type SupportedPetType = (typeof PET_TYPE_OPTIONS)[number]['key'];

export interface WorkerPricingScreenProps {
  workerId: string;
  apiBaseUrl?: string;
}

export function formatRupiah(num: number): string {
  return 'Rp ' + num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function parseRupiah(text: string): number {
  const digits = text.replace(/[^\d]/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

export const WorkerPricingScreen: React.FC<WorkerPricingScreenProps> = ({
  workerId,
  apiBaseUrl = 'https://api.petmatch.id',
}) => {
  const [selectedPetTypes, setSelectedPetTypes] = useState<SupportedPetType[]>([
    'DOG_SMALL',
    'CAT',
  ]);
  const [price30m, setPrice30m] = useState<number>(35000);
  const [price60m, setPrice60m] = useState<number>(60000);
  const [price120m, setPrice120m] = useState<number>(110000);
  const [priceOvernight, setPriceOvernight] = useState<number>(180000);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const togglePetType = (key: SupportedPetType) => {
    setSelectedPetTypes((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    );
  };

  const handleSave = async () => {
    setErrorMessage(null);

    // Validation: at least one pet type
    if (selectedPetTypes.length === 0) {
      setErrorMessage('Pilih minimal satu jenis hewan yang dapat Anda tangani');
      return;
    }

    // Validation: duration tiers must be greater than zero
    if (price30m <= 0 || price60m <= 0 || price120m <= 0 || priceOvernight <= 0) {
      setErrorMessage('Semua tarif durasi (30m, 60m, 120m, 24h) wajib diisi lebih dari Rp 0');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`${apiBaseUrl}/workers/profile/pricing-capabilities`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supportedPetTypes: selectedPetTypes,
          price30m,
          price60m,
          price120m,
          priceOvernight,
        }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        throw new Error(err.message || 'Gagal menyimpan tarif layanan');
      }

      Alert.alert('Sukses', 'Tarif dan keahlian hewan berhasil diperbarui');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Gagal menyimpan perubahan');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.headerTitle}>Tarif & Jenis Hewan Layanan</Text>
      <Text style={styles.headerSubtitle}>
        Atur tarif durasi jalan-jalan dan centang jenis hewan yang bersedia Anda handle.
      </Text>

      {errorMessage && <Text style={styles.errorBanner}>{errorMessage}</Text>}

      {/* Pet Types Multi-select Chips */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Jenis Hewan yang Dikuasai</Text>
        <View style={styles.chipGroup}>
          {PET_TYPE_OPTIONS.map((opt) => {
            const isSelected = selectedPetTypes.includes(opt.key);
            return (
              <TouchableOpacity
                key={opt.key}
                style={[styles.chip, isSelected && styles.chipSelected]}
                onPress={() => togglePetType(opt.key)}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                  {isSelected ? `✓ ${opt.label}` : opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Pricing Tiers */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tarif Durasi (IDR)</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Sesi 30 Menit</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={formatRupiah(price30m)}
            onChangeText={(text) => setPrice30m(parseRupiah(text))}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Sesi 60 Menit (Standar)</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={formatRupiah(price60m)}
            onChangeText={(text) => setPrice60m(parseRupiah(text))}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Sesi 120 Menit (Intensif)</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={formatRupiah(price120m)}
            onChangeText={(text) => setPrice120m(parseRupiah(text))}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Overnight / 24 Jam (Boarding)</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={formatRupiah(priceOvernight)}
            onChangeText={(text) => setPriceOvernight(parseRupiah(text))}
          />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.saveButton, isSaving && styles.buttonDisabled]}
        onPress={handleSave}
        disabled={isSaving}
      >
        {isSaving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveButtonText}>Simpan Pengaturan Tarif</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
    padding: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
  },
  errorBanner: {
    backgroundColor: '#ffebee',
    color: '#c62828',
    padding: 12,
    borderRadius: 8,
    fontSize: 13,
    marginBottom: 16,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#eee',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#f5f5f5',
  },
  chipSelected: {
    backgroundColor: '#e8f5e9',
    borderColor: '#2e7d32',
  },
  chipText: {
    fontSize: 13,
    color: '#555',
  },
  chipTextSelected: {
    color: '#2e7d32',
    fontWeight: 'bold',
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    color: '#555',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  saveButton: {
    backgroundColor: '#2e7d32',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 32,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
