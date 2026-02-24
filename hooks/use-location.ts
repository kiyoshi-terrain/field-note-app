import { useState, useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';

export interface UserLocation {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  heading: number | null;
  timestamp: number;
}

interface UseLocationOptions {
  enabled?: boolean;
  accuracy?: Location.Accuracy;
  distanceInterval?: number;
  timeInterval?: number;
}

export function useLocation(options: UseLocationOptions = {}) {
  const {
    enabled = true,
    accuracy = Location.Accuracy.Balanced,
    distanceInterval = 5,
    timeInterval = 3000,
  } = options;

  const [location, setLocation] = useState<UserLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  const stopTracking = useCallback(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.remove();
      subscriptionRef.current = null;
    }
    setIsTracking(false);
  }, []);

  const startTracking = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission denied');
        setIsLoading(false);
        return;
      }

      stopTracking();

      const subscription = await Location.watchPositionAsync(
        { accuracy, distanceInterval, timeInterval },
        (locationData) => {
          setLocation({
            latitude: locationData.coords.latitude,
            longitude: locationData.coords.longitude,
            accuracy: locationData.coords.accuracy,
            heading: locationData.coords.heading,
            timestamp: locationData.timestamp,
          });
          setIsLoading(false);
        }
      );

      subscriptionRef.current = subscription;
      setIsTracking(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start location tracking');
      setIsLoading(false);
    }
  }, [accuracy, distanceInterval, timeInterval, stopTracking]);

  const getCurrentPosition = useCallback(async (): Promise<UserLocation | null> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission denied');
        return null;
      }

      const locationData = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const userLocation: UserLocation = {
        latitude: locationData.coords.latitude,
        longitude: locationData.coords.longitude,
        accuracy: locationData.coords.accuracy,
        heading: locationData.coords.heading,
        timestamp: locationData.timestamp,
      };

      setLocation(userLocation);
      return userLocation;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get current position');
      return null;
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      startTracking();
    }
    return () => {
      stopTracking();
    };
  }, [enabled]);

  return { location, error, isTracking, isLoading, startTracking, stopTracking, getCurrentPosition };
}
