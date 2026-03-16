import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useJournalStore, useSortedEntries } from '../store/journalStore';
import type { JournalEntry } from '../types';
import { format } from 'date-fns';
import { DEFAULT_MOOD_COLOR, getMoodMeta } from '../constants/moods';

export default function WorldMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const activeStyleRef = useRef<string | null>(null);
  const entries = useSortedEntries();
  const { mapCenter, mapZoom, selectEntry, selectedEntry, settings, previewEntry } = useJournalStore();
  const [mapReadyVersion, setMapReadyVersion] = useState(0);
  const [initialViewport] = useState<{ center: [number, number]; zoom: number }>(() => ({
    center: mapCenter,
    zoom: mapZoom,
  }));
  const mapStyle = settings.mapStyle;

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: mapStyle,
      center: initialViewport.center,
      zoom: initialViewport.zoom,
      pitch: 0,
      bearing: 0,
    });
    activeStyleRef.current = mapStyle;

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right');
    map.on('click', () => selectEntry(null));

    map.on('load', () => {
      setMapReadyVersion((version) => version + 1);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [initialViewport.center, initialViewport.zoom, mapStyle, selectEntry]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyVersion || activeStyleRef.current === mapStyle) return;

    activeStyleRef.current = mapStyle;
    map.setStyle(mapStyle);
    map.once('styledata', () => {
      setMapReadyVersion((version) => version + 1);
    });
  }, [mapReadyVersion, mapStyle]);

  // Fly to center when it changes
  useEffect(() => {
    if (mapRef.current && mapReadyVersion) {
      mapRef.current.flyTo({
        center: mapCenter,
        zoom: mapZoom,
        duration: 2000,
        essential: true,
      });
    }
  }, [mapCenter, mapZoom, mapReadyVersion]);

  // Draw journey line and markers
  useEffect(() => {
    if (!mapRef.current || !mapReadyVersion) return;
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

    // Glow effect
    map.addLayer({
      id: 'journey-line-glow',
      type: 'line',
      source: 'journey',
      paint: {
        'line-color': '#f0a500',
        'line-width': 6,
        'line-opacity': 0.3,
        'line-blur': 4,
      },
    });

    // Main line
    map.addLayer({
      id: 'journey-line',
      type: 'line',
      source: 'journey',
      paint: {
        'line-color': '#f0a500',
        'line-width': 2.5,
        'line-opacity': 0.8,
        'line-dasharray': [2, 1],
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

    if (previewEntry && !entries.some((entry) => entry.id === previewEntry.id)) {
      const el = createMarkerElement(previewEntry, false, true);

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        selectEntry(previewEntry);
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([previewEntry.location.lng, previewEntry.location.lat])
        .addTo(map);

      markersRef.current.push(marker);
    }
  }, [entries, mapReadyVersion, previewEntry, selectEntry]);

  // Highlight selected marker
  useEffect(() => {
    markersRef.current.forEach((marker, i) => {
      const el = marker.getElement();
      if (entries[i] && selectedEntry && entries[i].id === selectedEntry.id) {
        el.classList.add('marker-selected');
      } else {
        el.classList.remove('marker-selected');
      }
    });
  }, [selectedEntry, entries]);

  return (
    <div className="world-map" ref={mapContainer} />
  );
}

function createMarkerElement(entry: JournalEntry, isLatest: boolean, isPreview = false): HTMLElement {
  const el = document.createElement('div');
  el.className = `map-marker ${isLatest ? 'marker-latest' : ''} ${isPreview ? 'marker-preview' : ''}`;

  const color = getMoodMeta(entry.mood)?.color ?? DEFAULT_MOOD_COLOR;

  el.innerHTML = `
    <div class="marker-pin" style="--marker-color: ${color}">
      <div class="marker-dot"></div>
      ${isLatest ? '<div class="marker-pulse"></div>' : ''}
    </div>
    <div class="marker-label">
      <span class="marker-date">${isPreview ? 'Draft preview' : format(new Date(entry.timestamp), 'MMM d')}</span>
    </div>
  `;

  return el;
}
