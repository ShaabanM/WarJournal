import { useEffect, useState } from 'react';
import { Globe, BarChart3, Sun, Moon, Navigation, Heart, MapPin } from 'lucide-react';
import { useJournalStore, useSortedEntries, getEntryDisplayDate } from '../store/journalStore';
import WorldMap from './WorldMap';
import JourneyDashboard from './JourneyDashboard';
import { getTotalDistance } from '../utils/geo';
import { getMoodColor } from '../utils/sentiment';
import { format } from 'date-fns';

export default function MapView() {
  const { loadEntries, loadSettings, settings, setTheme, setActiveEntryId } = useJournalStore();
  const sorted = useSortedEntries();
  const [showDashboard, setShowDashboard] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);

  useEffect(() => {
    loadSettings();
    loadEntries();
  }, [loadEntries, loadSettings]);

  // Set active to last entry so entire route shows as traveled
  useEffect(() => {
    if (sorted.length > 0) {
      setActiveEntryId(sorted[sorted.length - 1].id);
    }
  }, [sorted, setActiveEntryId]);

  // Stats
  const totalDistance = sorted.length > 1
    ? getTotalDistance(sorted.map((e) => e.location))
    : 0;
  const countries = new Set(sorted.map((e) => e.location.country).filter(Boolean));

  // Cluster cities (same logic as ReaderView)
  const cities = (() => {
    const clusters: { lat: number; lng: number; name: string }[] = [];
    for (const e of sorted) {
      const name = e.location.city || e.location.placeName || '';
      if (!name) continue;
      const nearby = clusters.find((c) => {
        const dlat = c.lat - e.location.lat;
        const dlng = c.lng - e.location.lng;
        return Math.sqrt(dlat * dlat + dlng * dlng) < 0.25;
      });
      if (!nearby) {
        clusters.push({ lat: e.location.lat, lng: e.location.lng, name });
      }
    }
    return clusters;
  })();

  const latestEntry = sorted[sorted.length - 1];
  const firstEntry = sorted[0];

  const firstDate = firstEntry ? new Date(getEntryDisplayDate(firstEntry)) : new Date();
  const lastDate = latestEntry ? new Date(getEntryDisplayDate(latestEntry)) : new Date();
  const tripDays = Math.max(1, Math.ceil((lastDate.getTime() - firstDate.getTime()) / 86400000) + 1);

  // Mood gradient for the arc
  const moodGradient = sorted.map((e, i) => {
    const color = getMoodColor(e.mood, e.moodColor);
    const pct = sorted.length <= 1 ? 50 : (i / (sorted.length - 1)) * 100;
    return `${color} ${pct}%`;
  }).join(', ');

  // Unique city stops for the route dots
  const routeStops: { city: string; color: string; date: string }[] = [];
  for (const e of sorted) {
    const city = e.location.city || e.location.placeName || '';
    const color = getMoodColor(e.mood, e.moodColor);
    const date = format(new Date(getEntryDisplayDate(e)), 'MMM d');
    if (routeStops.length === 0 || routeStops[routeStops.length - 1].city !== city) {
      routeStops.push({ city, color, date });
    }
  }

  return (
    <div className="mapview">
      {/* Full-screen map */}
      <div className="mapview-map">
        <WorldMap />
      </div>

      {/* Top bar */}
      <header className="mapview-topbar">
        <div className="mapview-topbar__brand">
          <Globe size={16} />
          <span className="mapview-topbar__title">War Journal</span>
          <span className="mapview-topbar__sep">/</span>
          <span className="mapview-topbar__subtitle">Live Map</span>
        </div>
        <div className="mapview-topbar__actions">
          <button
            className="mapview-btn"
            onClick={() => setShowDashboard(true)}
            title="View dashboard"
          >
            <BarChart3 size={14} />
            <span>Dashboard</span>
          </button>
          <button
            className="mapview-btn mapview-btn--icon"
            onClick={() => setTheme(settings.theme === 'light' ? 'dark' : 'light')}
            title="Toggle theme"
          >
            {settings.theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
          </button>
        </div>
      </header>

      {/* Info panel — overlays the map */}
      <div className={`mapview-panel ${panelCollapsed ? 'mapview-panel--collapsed' : ''}`}>
        <button
          className="mapview-panel__toggle"
          onClick={() => setPanelCollapsed(!panelCollapsed)}
          title={panelCollapsed ? 'Expand panel' : 'Collapse panel'}
        >
          {panelCollapsed ? <Navigation size={14} /> : <span className="mapview-panel__toggle-chevron" />}
        </button>

        {!panelCollapsed && (
          <>
            {/* Current location */}
            {latestEntry && (
              <div className="mapview-current">
                <div className="mapview-current__indicator" />
                <div className="mapview-current__info">
                  <span className="mapview-current__city">
                    {latestEntry.location.city || latestEntry.location.placeName || 'Unknown'}
                  </span>
                  <span className="mapview-current__country">
                    {latestEntry.location.country || ''}
                    {' \u00b7 '}
                    {format(lastDate, 'MMM d, yyyy')}
                  </span>
                </div>
                {latestEntry.mood && (
                  <span
                    className="mapview-current__mood"
                    style={{ '--mood-color': getMoodColor(latestEntry.mood, latestEntry.moodColor) } as React.CSSProperties}
                  >
                    {latestEntry.mood}
                  </span>
                )}
              </div>
            )}

            {/* Stats row */}
            <div className="mapview-stats">
              <div className="mapview-stat">
                <span className="mapview-stat__value">{Math.round(totalDistance).toLocaleString()}</span>
                <span className="mapview-stat__label">km</span>
              </div>
              <div className="mapview-stat">
                <span className="mapview-stat__value">{cities.length}</span>
                <span className="mapview-stat__label">cities</span>
              </div>
              <div className="mapview-stat">
                <span className="mapview-stat__value">{countries.size}</span>
                <span className="mapview-stat__label">countries</span>
              </div>
              <div className="mapview-stat">
                <span className="mapview-stat__value">{tripDays}</span>
                <span className="mapview-stat__label">days</span>
              </div>
            </div>

            {/* Route dots */}
            <div className="mapview-route">
              <h4 className="mapview-route__title">
                <MapPin size={12} />
                Route
              </h4>
              <div className="mapview-route__stops">
                {routeStops.map((stop, i) => (
                  <div className="mapview-route__stop" key={i}>
                    {i > 0 && <div className="mapview-route__line" />}
                    <div className="mapview-route__dot" style={{ background: stop.color }} />
                    <div className="mapview-route__info">
                      <span className="mapview-route__city">{stop.city || '?'}</span>
                      <span className="mapview-route__date">{stop.date}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mood arc */}
            {sorted.length > 1 && (
              <div className="mapview-mood">
                <h4 className="mapview-route__title">
                  <Heart size={12} />
                  Mood
                </h4>
                <div
                  className="mapview-mood__bar"
                  style={{ background: `linear-gradient(to right, ${moodGradient})` }}
                />
                <div className="mapview-mood__labels">
                  <span>{format(firstDate, 'MMM d')}</span>
                  <span>{format(lastDate, 'MMM d')}</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Dashboard modal */}
      {showDashboard && (
        <JourneyDashboard
          onClose={() => setShowDashboard(false)}
          totalDistance={totalDistance}
          cityCount={cities.length}
          countryCount={countries.size}
        />
      )}
    </div>
  );
}
