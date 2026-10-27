import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';

const { width } = Dimensions.get('window');

export interface RoutePoint {
  latitude: number;
  longitude: number;
  timestamp: string;
}

export interface OwnerLiveTrackingScreenProps {
  bookingId: string;
  workerName: string;
  wsBaseUrl?: string;
  authToken?: string;
  onOpenChat?: () => void;
  onEmergencyCall?: () => void;
}

export const OwnerLiveTrackingScreen: React.FC<OwnerLiveTrackingScreenProps> = ({
  bookingId,
  workerName,
  wsBaseUrl = 'wss://api.petmatch.id',
  authToken,
  onOpenChat,
  onEmergencyCall,
}) => {
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([
    { latitude: -6.2088, longitude: 106.8456, timestamp: new Date().toISOString() },
  ]);
  const [currentWorkerPos, setCurrentWorkerPos] = useState<RoutePoint>({
    latitude: -6.2088,
    longitude: 106.8456,
    timestamp: new Date().toISOString(),
  });
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [distanceKm, setDistanceKm] = useState<number>(0.0);
  const [isConnected, setIsConnected] = useState<boolean>(true);

  // Timer counter
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // WebSocket connection & live streaming
  useEffect(() => {
    // In production, connects via native WebSocket:
    // const ws = new WebSocket(`${wsBaseUrl}/tracking/${bookingId}?token=${authToken}`);
    // Simulated updates every 5s
    const wsMock = setInterval(() => {
      const deltaLat = (Math.random() - 0.5) * 0.0005;
      const deltaLng = (Math.random() - 0.5) * 0.0005;
      setCurrentWorkerPos((prev) => {
        const nextPoint: RoutePoint = {
          latitude: prev.latitude + deltaLat,
          longitude: prev.longitude + deltaLng,
          timestamp: new Date().toISOString(),
        };
        setRoutePoints((points) => [...points, nextPoint]);
        setDistanceKm((dist) => +(dist + 0.04).toFixed(2));
        return nextPoint;
      });
    }, 5000);

    return () => {
      clearInterval(wsMock);
    };
  }, [bookingId, wsBaseUrl, authToken]);

  const formatElapsedTime = (sec: number): string => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      {/* Map Surface (react-native-maps MapView with Polyline & Marker) */}
      <View style={styles.mapCanvas}>
        {/* Polyline Path Simulation */}
        <View style={styles.polylineGraphic}>
          <Text style={styles.routePointsBadge}>
            📍 Jalur Tracking: {routePoints.length} Titik GPS
          </Text>
        </View>

        {/* Worker Pin */}
        <View style={styles.workerMarker}>
          <View style={styles.workerAvatar}>
            <Text style={styles.markerEmoji}>🚶‍♂️</Text>
          </View>
          <View style={styles.workerLabel}>
            <Text style={styles.workerLabelText}>{workerName}</Text>
          </View>
        </View>
      </View>

      {/* Floating Header */}
      <View style={styles.floatingHeader}>
        <View style={[styles.statusDot, isConnected ? styles.dotLive : styles.dotOffline]} />
        <Text style={styles.statusText}>{isConnected ? 'LIVE TRACKING' : 'CONNECTING...'}</Text>
      </View>

      {/* Bottom Floating Stats Sheet */}
      <View style={styles.statsSheet}>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{formatElapsedTime(elapsedSeconds)}</Text>
            <Text style={styles.statLabel}>Durasi Jalan</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statBox}>
            <Text style={styles.statValue}>{distanceKm.toFixed(2)} km</Text>
            <Text style={styles.statLabel}>Jarak Ditempuh</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statBox}>
            <Text style={styles.statValue}>Aman</Text>
            <Text style={styles.statLabel}>Status</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.chatButton} onPress={onOpenChat}>
            <Text style={styles.chatButtonText}>💬 Chat Worker</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.sosButton} onPress={onEmergencyCall}>
            <Text style={styles.sosButtonText}>⚠️ Bantuan Darurat</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#dfe6e9',
  },
  mapCanvas: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  polylineGraphic: {
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 8,
    marginBottom: 20,
  },
  routePointsBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2d3436',
  },
  workerMarker: {
    alignItems: 'center',
  },
  workerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2e7d32',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    elevation: 4,
  },
  markerEmoji: {
    fontSize: 20,
  },
  workerLabel: {
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 4,
    elevation: 2,
  },
  workerLabelText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#333',
  },
  floatingHeader: {
    position: 'absolute',
    top: 50,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 3,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  dotLive: {
    backgroundColor: '#d63031',
  },
  dotOffline: {
    backgroundColor: '#b2bec3',
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    color: '#2d3436',
  },
  statsSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    elevation: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 18,
  },
  statBox: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#212121',
  },
  statLabel: {
    fontSize: 12,
    color: '#636e72',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#eee',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  chatButton: {
    flex: 1,
    backgroundColor: '#2e7d32',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  chatButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  sosButton: {
    flex: 1,
    backgroundColor: '#d63031',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  sosButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
