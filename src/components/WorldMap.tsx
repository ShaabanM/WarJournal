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

// ---------------------------------------------------------------------------
// Pre-computed driving routes (fetched from OSRM at publish time).
// Keyed by "entryId1:entryId2". Flights (>500km) have no route — use Bézier.
// ---------------------------------------------------------------------------
import precomputedRoutes from '../data/routes.json';

/**
 * Bézier arc for segments with no pre-computed route.
 * For long flights (>1500km), produces a dramatic high arc that pushes
 * the midpoint toward higher latitude — simulating a 3D "up and over"
 * flight path as seen on airline route maps.
 */
function bezierArc(
  start: number[], end: number[], segIndex: number, steps = 40
): number[][] {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 0.005) return [start, end];

  const kmApprox = dist * 111;
  const midLng = (start[0] + end[0]) / 2;
  const midLat = (start[1] + end[1]) / 2;

  let cx: number, cy: number;

  if (kmApprox > 1500) {
    // FLIGHT: dramatic arc pushing north (higher latitude) to simulate altitude
    // The longer the flight, the higher the arc
    const heightFactor = Math.min(0.35, kmApprox / 15000 + 0.15);
    const latBoost = dist * heightFactor;
    // Push the control point north (positive lat) for a "climbing" arc
    cx = midLng;
    cy = midLat + latBoost;
  } else {
    // Short/medium: gentle perpendicular offset, alternating direction
    const factor = 0.07;
    const sign = segIndex % 2 === 0 ? 1 : -1;
    cx = midLng + (-dy / dist) * dist * factor * sign;
    cy = midLat + (dx / dist) * dist * factor * sign;
  }

  const points: number[][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    points.push([
      u * u * start[0] + 2 * u * t * cx + t * t * end[0],
      u * u * start[1] + 2 * u * t * cy + t * t * end[1],
    ]);
  }
  return points;
}

/** Runtime route cache — survives re-renders, cleared on page reload */
const runtimeRouteCache: Record<string, number[][]> = {};

/** Segments we've already started fetching (avoid duplicate requests) */
const fetchingRoutes = new Set<string>();

interface MissingSegment {
  key: string;
  start: number[];
  end: number[];
}

/** Check if a pre-computed route's endpoints still match the current entry coords */
function routeEndpointsMatch(route: number[][], startLng: number, startLat: number, endLng: number, endLat: number): boolean {
  const threshold = 0.005; // ~500m tolerance
  const s = route[0];
  const e = route[route.length - 1];
  return (
    Math.abs(s[0] - startLng) < threshold &&
    Math.abs(s[1] - startLat) < threshold &&
    Math.abs(e[0] - endLng) < threshold &&
    Math.abs(e[1] - endLat) < threshold
  );
}

/**
 * Build the full journey path synchronously.
 * Uses pre-computed routes, runtime-cached routes, then Bézier fallback.
 * Detects stale routes (entry coords changed) and queues re-fetch.
 * Returns which short-distance segments still need fetching.
 */
function buildJourneyPath(
  entries: JournalEntry[]
): { coords: number[][]; splits: number[]; missing: MissingSegment[] } {
  const coords: number[][] = [];
  const splits: number[] = [];
  const missing: MissingSegment[] = [];
  const precomputed = precomputedRoutes as Record<string, number[][]>;

  for (let i = 0; i < entries.length; i++) {
    splits.push(coords.length);
    if (i === 0) {
      coords.push([entries[0].location.lng, entries[0].location.lat]);
      continue;
    }

    const a = [entries[i - 1].location.lng, entries[i - 1].location.lat];
    const b = [entries[i].location.lng, entries[i].location.lat];
    const key = `${entries[i - 1].id}:${entries[i].id}`;

    // Use cached route only if endpoints still match current entry coords
    const route = runtimeRouteCache[key] || precomputed[key];
    const valid = route && route.length >= 2 && routeEndpointsMatch(route, a[0], a[1], b[0], b[1]);

    if (valid) {
      coords.push(...route.slice(1));
    } else {
      // Bézier fallback (renders immediately — may be replaced later)
      const seg = bezierArc(a, b, i - 1);
      coords.push(...seg.slice(1));

      // Queue for background fetch if short enough for a driving route
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const kmApprox = Math.sqrt(dx * dx + dy * dy) * 111;
      if (kmApprox < 500 && !fetchingRoutes.has(key)) {
        missing.push({ key, start: a, end: b });
      }
    }
  }

  return { coords, splits, missing };
}

/**
 * Fetch a driving route from OSRM in the background.
 * Returns simplified coordinates (~150 points) or null on failure.
 */
async function fetchOSRMRoute(start: number[], end: number[]): Promise<number[][] | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${start[0]},${start[1]};${end[0]},${end[1]}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const full: number[][] = data.routes?.[0]?.geometry?.coordinates;
    if (!full || full.length < 2) return null;

    // Simplify to ~150 points
    const step = Math.max(1, Math.floor(full.length / 150));
    const simplified = full.filter((_: number[], i: number) => i % step === 0);
    if (simplified[simplified.length - 1] !== full[full.length - 1]) {
      simplified.push(full[full.length - 1]);
    }
    return simplified;
  } catch {
    return null;
  }
}

export default function WorldMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const lastFlyRef = useRef<string>('');
  // Curved path + split indices for traveled/ahead line updates
  const curvedPathRef = useRef<{ coords: number[][]; splits: number[] }>({ coords: [], splits: [] });
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

    // Special: "journey-end" → zoom out to show the full route
    if (activeEntryId === 'journey-end' && entries.length >= 2) {
      if (lastFlyRef.current === 'journey-end') return;
      lastFlyRef.current = 'journey-end';

      // Include all entry locations AND the Bézier arc control points
      // so flight arcs aren't clipped by the viewport
      const { coords } = curvedPathRef.current;
      const allLngs = coords.map((c) => c[0]);
      const allLats = coords.map((c) => c[1]);
      const bounds = new maplibregl.LngLatBounds(
        [Math.min(...allLngs), Math.min(...allLats)],
        [Math.max(...allLngs), Math.max(...allLats)]
      );

      mapRef.current.fitBounds(bounds, {
        padding: { top: 100, bottom: 100, left: 100, right: 100 },
        pitch: 0,
        bearing: 0,
        duration: 2500,
        essential: true,
        maxZoom: 8,
      });
      return;
    }

    const entry = entries.find((e) => e.id === activeEntryId);
    if (!entry) return;

    const idx = entries.indexOf(entry);

    // Fit the map to show both the current entry AND the previous one,
    // so the route segment between them is always visible.
    if (idx > 0) {
      const prev = entries[idx - 1].location;
      const flyKey = `${idx}:${entry.location.lng},${entry.location.lat}`;
      if (flyKey === lastFlyRef.current) return;
      lastFlyRef.current = flyKey;

      const bounds = new maplibregl.LngLatBounds(
        [Math.min(entry.location.lng, prev.lng), Math.min(entry.location.lat, prev.lat)],
        [Math.max(entry.location.lng, prev.lng), Math.max(entry.location.lat, prev.lat)]
      );

      mapRef.current.fitBounds(bounds, {
        padding: { top: 100, bottom: 100, left: 100, right: 100 },
        pitch: 40 + Math.random() * 15,
        bearing: -15 + Math.random() * 30,
        duration: 1800,
        essential: true,
        maxZoom: 14,
      });
    } else {
      const flyKey = `${idx}:${entry.location.lng},${entry.location.lat}`;
      if (flyKey === lastFlyRef.current) return;
      lastFlyRef.current = flyKey;

      mapRef.current.flyTo({
        center: [entry.location.lng, entry.location.lat],
        zoom: 10,
        pitch: 40 + Math.random() * 15,
        bearing: -15 + Math.random() * 30,
        duration: 1800,
        essential: true,
      });
    }
  }, [activeEntryId, entries, mapLoaded]);

  // Counter to trigger a rebuild after background routes arrive
  const [routeGeneration, setRouteGeneration] = useState(0);

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

    // Build path — renders immediately with Bézier fallbacks
    const path = buildJourneyPath(entries);
    curvedPathRef.current = path;

    // Background-fetch any missing driving routes, then rebuild seamlessly
    if (path.missing.length > 0) {
      const pending = path.missing.map(({ key, start, end }) => {
        fetchingRoutes.add(key);
        return fetchOSRMRoute(start, end).then((route) => {
          if (route) runtimeRouteCache[key] = route;
          fetchingRoutes.delete(key);
        });
      });
      Promise.all(pending).then(() => {
        // Bump generation → triggers this effect again with cached routes
        setRouteGeneration((g) => g + 1);
      });
    }

    const makeLineGeoJSON = (c: number[][]) => ({
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'LineString' as const, coordinates: c },
    });

    map.addSource('journey', { type: 'geojson', data: makeLineGeoJSON(path.coords) });
    map.addSource('journey-traveled', { type: 'geojson', data: makeLineGeoJSON(path.coords) });
    map.addSource('journey-ahead', { type: 'geojson', data: makeLineGeoJSON([]) });

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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, mapLoaded, selectEntry, routeGeneration]);

  // Update traveled / ahead line split when active entry changes
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || entries.length < 2) return;
    const map = mapRef.current;

    const traveledSrc = map.getSource('journey-traveled') as maplibregl.GeoJSONSource | undefined;
    const aheadSrc = map.getSource('journey-ahead') as maplibregl.GeoJSONSource | undefined;
    if (!traveledSrc || !aheadSrc) return;

    const { coords, splits } = curvedPathRef.current;
    if (coords.length === 0) return;

    const activeIdx = activeEntryId
      ? entries.findIndex((e) => e.id === activeEntryId)
      : -1;

    // Split at the curved-coords index for the entry AFTER the active one
    const nextEntryIdx = activeIdx >= 0 ? activeIdx + 1 : entries.length;
    const splitAt = nextEntryIdx < splits.length ? splits[nextEntryIdx] : coords.length;

    const traveledCoords = coords.slice(0, splitAt);
    const aheadCoords = splitAt < coords.length ? coords.slice(splitAt - 1) : [];

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
