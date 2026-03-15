import { useState, useCallback } from 'react';
import type { GeoLocation } from '../types';
import { getCurrentPosition, reverseGeocode } from '../utils/geo';

interface UseGeolocationReturn {
  location: GeoLocation | null;
  isLocating: boolean;
  error: string | null;
  getLocation: () => Promise<GeoLocation | null>;
}

export function useGeolocation(): UseGeolocationReturn {
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getLocation = useCallback(async (): Promise<GeoLocation | null> => {
    setIsLocating(true);
    setError(null);
    try {
      const position = await getCurrentPosition();
      const { latitude: lat, longitude: lng } = position.coords;
      const geoDetails = await reverseGeocode(lat, lng);
      const loc: GeoLocation = { lat, lng, ...geoDetails };
      setLocation(loc);
      return loc;
    } catch (err) {
      const msg = err instanceof GeolocationPositionError
        ? getGeolocationErrorMessage(err)
        : 'Failed to get location';
      setError(msg);
      return null;
    } finally {
      setIsLocating(false);
    }
  }, []);

  return { location, isLocating, error, getLocation };
}

function getGeolocationErrorMessage(err: GeolocationPositionError): string {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return 'Location permission denied. Please enable location access.';
    case err.POSITION_UNAVAILABLE:
      return 'Location unavailable. Check your GPS.';
    case err.TIMEOUT:
      return 'Location request timed out. Try again.';
    default:
      return 'Unknown location error.';
  }
}
