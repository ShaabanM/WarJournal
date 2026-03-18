import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useJournalStore, useSortedEntries, getEntryDisplayDate } from '../store/journalStore';
import { getMoodColor } from '../utils/sentiment';
import type { JournalEntry } from '../types';
import { format } from 'date-fns';

// CARTO Positron — light, minimal base. We recolor every layer after load to parchment tones.
const PARCHMENT_BASE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

/**
 * Recolor all map layers to a medieval parchment palette.
 * Water → tan, land → cream, roads → brown ink, labels → dark brown.
 */
function applyParchmentSkin(map: maplibregl.Map) {
  const style = map.getStyle();
  if (!style?.layers) return;

  for (const layer of style.layers) {
    const id = layer.id.toLowerCase();
    try {
      // Background → warm parchment
      if (layer.type === 'background') {
        map.setPaintProperty(layer.id, 'background-color', '#e8dcc4');
        continue;
      }

      // Water → aged tan (no blue!)
      if (id.includes('water')) {
        if (layer.type === 'fill') {
          map.setPaintProperty(layer.id, 'fill-color', '#c9b99a');
        } else if (layer.type === 'line') {
          map.setPaintProperty(layer.id, 'line-color', '#b8a888');
        }
        continue;
      }

      // Parks / green areas → muted olive
      if (id.includes('park') || id.includes('green') || id.includes('landcover')) {
        if (layer.type === 'fill') {
          map.setPaintProperty(layer.id, 'fill-color', '#d5caa2');
          map.setPaintProperty(layer.id, 'fill-opacity', 0.6);
        }
        continue;
      }

      // Land use → light parchment variation
      if (id.includes('landuse')) {
        if (layer.type === 'fill') {
          map.setPaintProperty(layer.id, 'fill-color', '#ddd2b4');
        }
        continue;
      }

      // Roads → faded brown ink
      if (id.includes('road') || id.includes('highway') || id.includes('tunnel') || id.includes('bridge') || id.includes('path') || id.includes('transit')) {
        if (layer.type === 'line') {
          map.setPaintProperty(layer.id, 'line-color', '#c2ad8a');
        }
        continue;
      }

      // Buildings → warm stone
      if (id.includes('building')) {
        if (layer.type === 'fill') {
          map.setPaintProperty(layer.id, 'fill-color', '#d8ccb0');
        }
        continue;
      }

      // Boundaries → dark brown ink
      if (id.includes('boundary') || id.includes('admin')) {
        if (layer.type === 'line') {
          map.setPaintProperty(layer.id, 'line-color', '#8b7355');
        }
        continue;
      }

      // Labels → dark brown ink on parchment halo
      if (layer.type === 'symbol') {
        try { map.setPaintProperty(layer.id, 'text-color', '#4a3728'); } catch {}
        try { map.setPaintProperty(layer.id, 'text-halo-color', '#e8dcc4'); } catch {}
        try { map.setPaintProperty(layer.id, 'text-halo-width', 1.5); } catch {}
        continue;
      }
    } catch {
      // Skip layers that can't be modified
    }
  }
}

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
      style: PARCHMENT_BASE,
      center: mapCenter,
      zoom: mapZoom,
      pitch: 35,
      bearing: -10,
      maxPitch: 60,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right');

    map.on('load', () => {
      applyParchmentSkin(map);
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

  // Theme changes — same positron base for both, CSS handles parchment look
  // Re-trigger journey line + markers rebuild so lineColor updates
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    setMapLoaded(false);
    requestAnimationFrame(() => setMapLoaded(true));
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

    // Remove old journey layers
    for (const id of ['journey-line-solid', 'journey-line-dashed', 'journey-line-glow']) {
      if (map.getLayer(id)) map.removeLayer(id);
    }
    for (const id of ['journey', 'journey-traveled', 'journey-ahead']) {
      if (map.getSource(id)) map.removeSource(id);
    }

    if (entries.length === 0) return;

    const coordinates = entries.map((e) => [e.location.lng, e.location.lat]);
    const makeLineGeoJSON = (coords: number[][]) => ({
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'LineString' as const, coordinates: coords },
    });

    // Full route (for glow)
    map.addSource('journey', {
      type: 'geojson',
      data: makeLineGeoJSON(coordinates),
    });

    // Traveled portion (start → active entry) — updated on activeEntryId change
    map.addSource('journey-traveled', {
      type: 'geojson',
      data: makeLineGeoJSON(coordinates),
    });

    // Upcoming portion (active entry → end) — updated on activeEntryId change
    map.addSource('journey-ahead', {
      type: 'geojson',
      data: makeLineGeoJSON([]),
    });

    // Medieval ink — golden on dark parchment, dark brown on light
    const lineColor = isDark ? '#c9a96e' : '#3d2b1f';

    // Wide outer glow on full route — ink bleed on parchment
    map.addLayer({
      id: 'journey-line-glow',
      type: 'line',
      source: 'journey',
      paint: {
        'line-color': lineColor,
        'line-width': 14,
        'line-opacity': 0.15,
        'line-blur': 10,
      },
    });

    // Dashed "ahead" line — the journey yet to be read
    map.addLayer({
      id: 'journey-line-dashed',
      type: 'line',
      source: 'journey-ahead',
      paint: {
        'line-color': lineColor,
        'line-width': 2,
        'line-opacity': 0.35,
        'line-dasharray': [2, 3],
      },
    });

    // Solid "traveled" line — the journey already read
    map.addLayer({
      id: 'journey-line-solid',
      type: 'line',
      source: 'journey-traveled',
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

  // Update traveled / ahead line split when active entry changes
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || entries.length < 2) return;
    const map = mapRef.current;

    const traveledSrc = map.getSource('journey-traveled') as maplibregl.GeoJSONSource | undefined;
    const aheadSrc = map.getSource('journey-ahead') as maplibregl.GeoJSONSource | undefined;
    if (!traveledSrc || !aheadSrc) return;

    const coordinates = entries.map((e) => [e.location.lng, e.location.lat]);
    const activeIdx = activeEntryId
      ? entries.findIndex((e) => e.id === activeEntryId)
      : -1;

    // Split point: include the active entry in "traveled", rest in "ahead"
    const splitAt = activeIdx >= 0 ? activeIdx + 1 : coordinates.length;

    const traveledCoords = coordinates.slice(0, splitAt);
    const aheadCoords = splitAt < coordinates.length ? coordinates.slice(splitAt - 1) : [];

    traveledSrc.setData({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: traveledCoords },
    });

    aheadSrc.setData({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: aheadCoords.length >= 2 ? aheadCoords : [] },
    });
  }, [activeEntryId, entries, mapLoaded]);

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
