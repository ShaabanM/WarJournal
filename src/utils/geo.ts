import type { GeoLocation } from '../types';

export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 60000,
    });
  });
}

export async function reverseGeocode(lat: number, lng: number): Promise<Partial<GeoLocation>> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en`
    );
    if (res.ok) {
      const data = await res.json();
      const address = data.address || {};
      return {
        placeName: data.display_name?.split(',').slice(0, 3).join(',') || undefined,
        city: address.city || address.town || address.village || address.county || undefined,
        country: address.country || undefined,
      };
    }
  } catch (err) {
    console.warn('Reverse geocode failed:', err);
  }
  return {};
}

export interface GeocodingResult {
  displayName: string;
  lat: number;
  lng: number;
  city?: string;
  country?: string;
}

/**
 * Forward geocode: search for a place by name using Nominatim.
 * Returns up to 5 results with coordinates and address info.
 */
export async function geocodePlace(query: string): Promise<GeocodingResult[]> {
  if (!query.trim()) return [];
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1&accept-language=en`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.map((item: Record<string, unknown>) => {
      const address = (item.address || {}) as Record<string, string>;
      return {
        displayName: item.display_name as string,
        lat: parseFloat(item.lat as string),
        lng: parseFloat(item.lon as string),
        city: address.city || address.town || address.village || address.county || undefined,
        country: address.country || undefined,
      };
    });
  } catch (err) {
    console.warn('Geocode search failed:', err);
    return [];
  }
}

export function formatCoordinates(lat: number, lng: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lng).toFixed(4)}°${lngDir}`;
}

export function calculateDistance(loc1: GeoLocation, loc2: GeoLocation): number {
  const R = 6371; // km
  const dLat = toRad(loc2.lat - loc1.lat);
  const dLng = toRad(loc2.lng - loc1.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(loc1.lat)) * Math.cos(toRad(loc2.lat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

export function getTotalDistance(locations: GeoLocation[]): number {
  let total = 0;
  for (let i = 1; i < locations.length; i++) {
    total += calculateDistance(locations[i - 1], locations[i]);
  }
  return total;
}
