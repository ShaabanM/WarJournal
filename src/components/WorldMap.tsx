import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useJournalStore, useSortedEntries, getEntryDisplayDate } from '../store/journalStore';
import { getMoodColor } from '../utils/sentiment';
import type { JournalEntry } from '../types';
import { format } from 'date-fns';

// Medieval parchment map — hand-painted Stamen Watercolor raster tiles
const MEDIEVAL_STYLE = {
  version: 8 as const,
  sources: {
    'stamen-watercolor': {
      type: 'raster' as const,
      tiles: [
        'https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg',
      ],
      tileSize: 256,
      maxzoom: 16,
      attribution:
        '&copy; <a href="https://stamen.com">Stamen Design</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
  },
  layers: [
    {
      id: 'stamen-watercolor-layer',
      type: 'raster' as const,
      source: 'stamen-watercolor',
    },
  ],
};

export default function WorldMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const lastFlyRef = useRef<string>('');
  const entries = useSortedEntries();
  const { mapCenter, mapZoom, selectEntry, selectedEntry, activeEntryId, settings } = useJournalStore();
  const [mapLoaded, setMapLoaded] = useState(false);
  const isDark = settings.theme !== 'light';

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: MEDIEVAL_STYLE,
      center: mapCenter,
      zoom: mapZoom,
      pitch: 35,
      bearing: -10,
      maxPitch: 60,
      maxZoom: 16,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right');

    map.on('load', () => {
      setMapLoaded(true);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ResizeObserver — resize map when container size changes (sticky layout)
  useEffect(() => {
    if (!mapContainer.current || !mapRef.current) return;
    const map = mapRef.current;

    const ro = new ResizeObserver(() => {
      map.resize();
    });
    ro.observe(mapContainer.current);

    return () => ro.disconnect();
  }, [mapLoaded]);

  // Theme changes — same watercolor tiles for both modes, CSS handles dark/light
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    mapRef.current.resize();
  }, [isDark]);

  // Fly to center when it changes (user-initiated, e.g. flyToEntry in author view)
  useEffect(() => {
    if (mapRef.current && mapLoaded) {
      mapRef.current.flyTo({
        center: mapCenter,
        zoom: mapZoom,
        duration: 2000,
        essential: true,
      });
    }
  }, [mapCenter, mapZoom, mapLoaded]);

  // Scroll-driven flyTo when activeEntryId changes
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !activeEntryId) return;

    const entry = entries.find((e) => e.id === activeEntryId);
    if (!entry) return;

    const key = `${entry.location.lng},${entry.location.lat}`;
    if (key === lastFlyRef.current) return; // skip duplicate
    lastFlyRef.current = key;

    mapRef.current.flyTo({
      center: [entry.location.lng, entry.location.lat],
      zoom: Math.max(mapRef.current.getZoom(), 6),
      pitch: 40 + Math.random() * 15,
      bearing: -15 + Math.random() * 30,
      duration: 1800,
      essential: true,
    });
  }, [activeEntryId, entries, mapLoaded]);

  // Draw journey line and markers
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;

    // Clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Remove old journey line
    if (map.getLayer('journey-line')) map.removeLayer('journey-line');
    if (map.getLayer('journey-line-glow')) map.removeLayer('journey-line-glow');
    if (map.getSource('journey')) map.removeSource('journey');

    if (entries.length === 0) return;

    // Add journey line
    const coordinates = entries.map((e) => [e.location.lng, e.location.lat]);

    map.addSource('journey', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates,
        },
      },
    });

    // Medieval ink — golden on dark parchment, dark brown on light
    const lineColor = isDark ? '#c9a96e' : '#3d2b1f';

    // Wide outer glow — ink bleed on parchment
    map.addLayer({
      id: 'journey-line-glow',
      type: 'line',
      source: 'journey',
      paint: {
        'line-color': lineColor,
        'line-width': 14,
        'line-opacity': 0.25,
        'line-blur': 10,
      },
    });

    // Main line — inked path on parchment
    map.addLayer({
      id: 'journey-line',
      type: 'line',
      source: 'journey',
      paint: {
        'line-color': lineColor,
        'line-width': 3.5,
        'line-opacity': 0.95,
      },
    });

    // Add markers for each entry
    entries.forEach((entry, index) => {
      const el = createMarkerElement(entry, index === entries.length - 1);

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        selectEntry(entry);
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([entry.location.lng, entry.location.lat])
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [entries, mapLoaded, selectEntry]);

  // Highlight active / selected marker
  useEffect(() => {
    markersRef.current.forEach((marker, i) => {
      const el = marker.getElement();
      const entry = entries[i];
      if (!entry) return;

      const isSelected = selectedEntry && entry.id === selectedEntry.id;
      const isActive = activeEntryId === entry.id;

      el.classList.toggle('marker-selected', !!isSelected);
      el.classList.toggle('marker-active', !!isActive);
    });
  }, [selectedEntry, activeEntryId, entries]);

  return (
    <div className="world-map" ref={mapContainer} />
  );
}

function createMarkerElement(entry: JournalEntry, isLatest: boolean): HTMLElement {
  const el = document.createElement('div');
  el.className = `map-marker ${isLatest ? 'marker-latest' : ''}`;

  const color = getMoodColor(entry.mood, entry.moodColor);
  const city = entry.location.city || entry.location.placeName || '';

  el.innerHTML = `
    <div class="marker-pin" style="--marker-color: ${color}">
      <div class="marker-dot"></div>
      ${isLatest ? '<div class="marker-pulse"></div>' : ''}
    </div>
    <div class="marker-label">
      <span class="marker-date">${format(new Date(getEntryDisplayDate(entry)), 'MMM d')}</span>
      ${city ? `<span class="marker-city">${city}</span>` : ''}
    </div>
  `;

  return el;
}
