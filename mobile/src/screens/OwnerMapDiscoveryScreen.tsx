import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useDeviceLocation, JAKARTA_CITIES, type CityOption } from '../hooks/useDeviceLocation';
import { WorkerRateCardSheet } from '../components/WorkerRateCardSheet';
import type { WorkerCardProfile } from '../types/worker';
import type { SupportedPetType } from '../../backend/src/services/pricing.service';

const { width, height } = Dimensions.get('window');

export interface OwnerMapDiscoveryScreenProps {
  apiBaseUrl?: string;
  onNavigateToBooking?: (worker: WorkerCardProfile, durationMinutes: number) => void;
}

export const PET_FILTER_OPTIONS: Array<{ key: SupportedPetType | 'ALL'; label: string }> = [
  { key: 'ALL', label: 'Semua Hewan' },
  { key: 'DOG_SMALL', label: 'Anjing Kecil' },
  { key: 'DOG_MEDIUM', label: 'Anjing Sedang' },
  { key: 'DOG_LARGE', label: 'Anjing Besar' },
  { key: 'CAT', label: 'Kucing' },
  { key: 'OTHER', label: 'Lainnya' },
];

export const OwnerMapDiscoveryScreen: React.FC<OwnerMapDiscoveryScreenProps> = ({
  apiBaseUrl = 'https://api.petmatch.id',
  onNavigateToBooking,
}) => {
  const { coordinates, showCitySelector, selectFallbackCity, closeCitySelector } = useDeviceLocation();
  const [selectedPetFilter, setSelectedPetFilter] = useState<SupportedPetType | 'ALL'>('ALL');
  const [workers, setWorkers] = useState<WorkerCardProfile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedWorker, setSelectedWorker] = useState<WorkerCardProfile | null>(null);
  const [isSheetVisible, setIsSheetVisible] = useState<boolean>(false);

  const fetchNearbyWorkers = useCallback(async () => {
    setIsLoading(true);
    try {
      const url = new URL(`${apiBaseUrl}/workers/nearby`);
      url.searchParams.append('latitude', String(coordinates.latitude));
      url.searchParams.append('longitude', String(coordinates.longitude));
      url.searchParams.append('radius_km', '5');

      if (selectedPetFilter !== 'ALL') {
        url.searchParams.append('pet_type', selectedPetFilter);
      }

      const res = await fetch(url.toString());
      if (res.ok) {
        const data = (await res.json()) as WorkerCardProfile[];
        setWorkers(data);
      }
    } catch {
      // Fallback empty on network error
      setWorkers([]);
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, coordinates, selectedPetFilter]);

  useEffect(() => {
    void fetchNearbyWorkers();
  }, [fetchNearbyWorkers]);

  const handleSelectWorker = (worker: WorkerCardProfile) => {
    setSelectedWorker(worker);
    setIsSheetVisible(true);
  };

  const handleProceedBooking = (worker: WorkerCardProfile, durationMinutes: number) => {
    setIsSheetVisible(false);
    if (onNavigateToBooking) {
      onNavigateToBooking(worker, durationMinutes);
    }
  };

  return (
    <View style={styles.container}>
      {/* Map Mock & Visual Canvas (Production uses <MapView> from react-native-maps) */}
      <View style={styles.mapCanvas}>
        {/* Owner Position & 5km Radius Circle Overlay */}
        <View style={styles.radiusCircle}>
          <View style={styles.ownerPin}>
            <View style={styles.ownerPinCore} />
          </View>
          <Text style={styles.radiusLabel}>Radius Layanan 5 KM</Text>
        </View>

        {/* Worker Pins */}
        {workers.map((w, idx) => (
          <TouchableOpacity
            key={w.id}
            style={[
              styles.workerPin,
              {
                top: height * 0.35 + (idx % 2 === 0 ? idx * 30 : -idx * 25),
                left: width * 0.45 + (idx % 2 === 0 ? -idx * 35 : idx * 30),
              },
            ]}
            onPress={() => handleSelectWorker(w)}
          >
            <Text style={styles.workerPinText}>🐾 {w.fullName.split(' ')[0]}</Text>
            <Text style={styles.workerPinSubText}>{w.ratingAvg.toFixed(1)}★</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Floating Filter Bar */}
      <View style={styles.floatingFilterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {PET_FILTER_OPTIONS.map((opt) => {
            const isSelected = selectedPetFilter === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[styles.filterChip, isSelected && styles.filterChipActive]}
                onPress={() => setSelectedPetFilter(opt.key)}
              >
                <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Loading Overlay */}
      {isLoading && (
        <View style={styles.loadingBadge}>
          <ActivityIndicator size="small" color="#2e7d32" />
          <Text style={styles.loadingText}>Mencari worker terdekat...</Text>
        </View>
      )}

      {/* Fallback City Selector Modal (shown when GPS denied) */}
      {showCitySelector && (
        <View style={styles.citySelectorOverlay}>
          <View style={styles.citySelectorCard}>
            <Text style={styles.citySelectorTitle}>Pilih Area Anda</Text>
            <Text style={styles.citySelectorSubtitle}>
              Izin GPS ditolak. Silakan pilih wilayah di Jakarta:
            </Text>
            {JAKARTA_CITIES.map((city: CityOption) => (
              <TouchableOpacity
                key={city.id}
                style={styles.cityOptionItem}
                onPress={() => selectFallbackCity(city)}
              >
                <Text style={styles.cityNameText}>{city.name}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.cancelCityButton} onPress={closeCitySelector}>
              <Text style={styles.cancelCityText}>Tutup</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Worker Rate Card Sheet */}
      <WorkerRateCardSheet
        worker={selectedWorker}
        visible={isSheetVisible}
        onClose={() => setIsSheetVisible(false)}
        onProceedBooking={handleProceedBooking}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e5e3df',
  },
  mapCanvas: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radiusCircle: {
    width: width * 0.75,
    height: width * 0.75,
    borderRadius: (width * 0.75) / 2,
    borderWidth: 2,
    borderColor: 'rgba(46, 125, 50, 0.4)',
    backgroundColor: 'rgba(46, 125, 50, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radiusLabel: {
    position: 'absolute',
    bottom: 12,
    fontSize: 11,
    fontWeight: 'bold',
    color: '#2e7d32',
  },
  ownerPin: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(25, 118, 210, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ownerPinCore: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#1976d2',
  },
  workerPin: {
    position: 'absolute',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#2e7d32',
  },
  workerPinText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#212121',
    marginRight: 4,
  },
  workerPinSubText: {
    fontSize: 11,
    color: '#f57f17',
    fontWeight: 'bold',
  },
  floatingFilterContainer: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  filterChipActive: {
    backgroundColor: '#2e7d32',
  },
  filterChipText: {
    fontSize: 13,
    color: '#444',
  },
  filterChipTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  loadingBadge: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 3,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#333',
  },
  citySelectorOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  citySelectorCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '100%',
  },
  citySelectorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: 4,
  },
  citySelectorSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
  },
  cityOptionItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  cityNameText: {
    fontSize: 15,
    color: '#1976d2',
    fontWeight: '500',
  },
  cancelCityButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  cancelCityText: {
    color: '#777',
    fontSize: 14,
  },
});
