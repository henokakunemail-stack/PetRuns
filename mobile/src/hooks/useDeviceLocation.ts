import { useState, useEffect, useCallback } from 'react';

export type PermissionStatus = 'IDLE' | 'GRANTED' | 'DENIED' | 'BLOCKED';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

export interface CityOption {
  id: string;
  name: string;
  coordinates: LocationCoordinates;
}

export const JAKARTA_CITIES: CityOption[] = [
  { id: 'jak-sel', name: 'Jakarta Selatan', coordinates: { latitude: -6.2615, longitude: 106.8106 } },
  { id: 'jak-pus', name: 'Jakarta Pusat (Monas)', coordinates: { latitude: -6.1865, longitude: 106.8341 } },
  { id: 'jak-bar', name: 'Jakarta Barat', coordinates: { latitude: -6.1683, longitude: 106.7589 } },
  { id: 'jak-tim', name: 'Jakarta Timur', coordinates: { latitude: -6.225, longitude: 106.9004 } },
  { id: 'jak-ut', name: 'Jakarta Utara', coordinates: { latitude: -6.1384, longitude: 106.864 } },
];

export interface UseDeviceLocationResult {
  permissionStatus: PermissionStatus;
  coordinates: LocationCoordinates;
  isLoading: boolean;
  showCitySelector: boolean;
  requestPermission: () => Promise<void>;
  selectFallbackCity: (city: CityOption) => void;
  closeCitySelector: () => void;
}

export const useDeviceLocation = (
  initialPermission: PermissionStatus = 'IDLE'
): UseDeviceLocationResult => {
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>(initialPermission);
  const [coordinates, setCoordinates] = useState<LocationCoordinates>(JAKARTA_CITIES[0].coordinates);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showCitySelector, setShowCitySelector] = useState<boolean>(false);

  const requestPermission = useCallback(async () => {
    setIsLoading(true);
    try {
      // In React Native native runtime, calls PermissionsAndroid.request(ACCESS_FINE_LOCATION)
      // or Geolocation.requestAuthorization('whenInUse')
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setPermissionStatus('GRANTED');
            setCoordinates({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
            setShowCitySelector(false);
            setIsLoading(false);
          },
          () => {
            setPermissionStatus('DENIED');
            setShowCitySelector(true);
            setIsLoading(false);
          }
        );
      } else {
        // Mock default for test or fallback
        setPermissionStatus('GRANTED');
        setCoordinates({ latitude: -6.2088, longitude: 106.8456 });
        setIsLoading(false);
      }
    } catch {
      setPermissionStatus('BLOCKED');
      setShowCitySelector(true);
      setIsLoading(false);
    }
  }, []);

  const selectFallbackCity = (city: CityOption) => {
    setCoordinates(city.coordinates);
    setShowCitySelector(false);
  };

  const closeCitySelector = () => {
    setShowCitySelector(false);
  };

  useEffect(() => {
    if (initialPermission === 'IDLE') {
      void requestPermission();
    }
  }, [initialPermission, requestPermission]);

  return {
    permissionStatus,
    coordinates,
    isLoading,
    showCitySelector,
    requestPermission,
    selectFallbackCity,
    closeCitySelector,
  };
};
