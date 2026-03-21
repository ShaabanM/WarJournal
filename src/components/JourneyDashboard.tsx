import { X, MapPin, Globe, Route, BookOpen, Camera, Newspaper, Heart, Trophy, ArrowRight, Plane, Navigation } from 'lucide-react';
import { useSortedEntries, getEntryDisplayDate } from '../store/journalStore';
import { calculateDistance } from '../utils/geo';
import { getMoodColor } from '../utils/sentiment';
import { format } from 'date-fns';
import type { JournalEntry } from '../types';

const COUNTRY_FLAGS: Record<string, string> = {
  'United Arab Emirates': '\u{1F1E6}\u{1F1EA}',
  'Italy': '\u{1F1EE}\u{1F1F9}',
  'Hungary': '\u{1F1ED}\u{1F1FA}',
  'France': '\u{1F1EB}\u{1F1F7}',
  'Germany': '\u{1F1E9}\u{1F1EA}',
  'Spain': '\u{1F1EA}\u{1F1F8}',
  'United Kingdom': '\u{1F1EC}\u{1F1E7}',
  'United States': '\u{1F1FA}\u{1F1F8}',
  'Turkey': '\u{1F1F9}\u{1F1F7}',
  'Egypt': '\u{1F1EA}\u{1F1EC}',
  'Greece': '\u{1F1EC}\u{1F1F7}',
  'Switzerland': '\u{1F1E8}\u{1F1ED}',
  'Austria': '\u{1F1E6}\u{1F1F9}',
  'Netherlands': '\u{1F1F3}\u{1F1F1}',
  'Czech Republic': '\u{1F1E8}\u{1F1FF}',
  'Czechia': '\u{1F1E8}\u{1F1FF}',
  'Poland': '\u{1F1F5}\u{1F1F1}',
  'Portugal': '\u{1F1F5}\u{1F1F9}',
  'Croatia': '\u{1F1ED}\u{1F1F7}',
  'Japan': '\u{1F1EF}\u{1F1F5}',
  'India': '\u{1F1EE}\u{1F1F3}',
  'Thailand': '\u{1F1F9}\u{1F1ED}',
};

function getFlag(country: string): string {
  return COUNTRY_FLAGS[country] || '\u{1F30D}';
}

interface Props {
  onClose: () => void;
  totalDistance: number;
  cityCount: number;
  countryCount: number;
}

export default function JourneyDashboard({ onClose, totalDistance, cityCount, countryCount }: Props) {
  const entries = useSortedEntries();
  if (entries.length === 0) return null;

  const firstDate = new Date(getEntryDisplayDate(entries[0]));
  const lastDate = new Date(getEntryDisplayDate(entries[entries.length - 1]));
  const tripDays = Math.max(1, Math.ceil((lastDate.getTime() - firstDate.getTime()) / 86400000) + 1);

  // Compute legs
  const legs: { from: JournalEntry; to: JournalEntry; km: number }[] = [];
  for (let i = 1; i < entries.length; i++) {
    const km = calculateDistance(entries[i - 1].location, entries[i].location);
    legs.push({ from: entries[i - 1], to: entries[i], km });
  }
  const longestLeg = legs.reduce((a, b) => (a.km > b.km ? a : b), legs[0]);
  const shortestLeg = legs.filter((l) => l.km > 0.5).reduce((a, b) => (a.km < b.km ? a : b), legs[0]);

  // Country stats
  const countryCounts: Record<string, number> = {};
  entries.forEach((e) => {
    const c = e.location.country || 'Unknown';
    countryCounts[c] = (countryCounts[c] || 0) + 1;
  });
  const countryList = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]);

  // City stats
  const cityEntries: Record<string, { count: number; country: string }> = {};
  for (const e of entries) {
    const name = e.location.city || e.location.placeName || '';
    const country = e.location.country || '';
    if (!name) continue;
    if (cityEntries[name]) {
      cityEntries[name].count += 1;
    } else {
      cityEntries[name] = { count: 1, country };
    }
  }
  const mostVisitedCity = Object.entries(cityEntries).sort((a, b) => b[1].count - a[1].count)[0];

  // Mood stats
  const moodCounts: Record<string, number> = {};
  entries.forEach((e) => {
    if (e.mood) moodCounts[e.mood] = (moodCounts[e.mood] || 0) + 1;
  });
  const topMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0];

  const totalPhotos = entries.reduce((sum, e) => sum + (e.photos?.length || 0), 0);
  const headlineCount = entries.filter((e) => e.newsHeadline).length;
  const cityName = (e: JournalEntry) => e.location.city || e.location.placeName || '?';

  // Build mood gradient for the arc bar
  const moodGradient = entries.map((e, i) => {
    const color = getMoodColor(e.mood, e.moodColor);
    const pct = entries.length <= 1 ? 50 : (i / (entries.length - 1)) * 100;
    return `${color} ${pct}%`;
  }).join(', ');

  // First and last city for header
  const originCity = cityName(entries[0]);
  const destCity = cityName(entries[entries.length - 1]);

  return (
    <div className="dashboard-overlay" onClick={onClose}>
      <div className="dashboard-panel" onClick={(e) => e.stopPropagation()}>
        {/* Close button — floating */}
        <button className="dashboard-close" onClick={onClose}>
          <X size={18} />
        </button>

        {/* Dramatic Hero Header */}
        <div className="dashboard-hero-header">
          <div className="dashboard-hero-header__ornament">
            <svg viewBox="0 0 200 20" className="dashboard-ornament-svg">
              <path d="M0,10 Q50,0 100,10 Q150,20 200,10" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.4" />
              <path d="M0,10 Q50,20 100,10 Q150,0 200,10" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.4" />
            </svg>
          </div>
          <p className="dashboard-hero-header__subtitle">A Chronicle of</p>
          <h2 className="dashboard-hero-header__title">The Journey</h2>
          <div className="dashboard-hero-header__route">
            <span>{originCity}</span>
            <Plane size={14} className="dashboard-hero-header__plane" />
            <span>{destCity}</span>
          </div>
          <p className="dashboard-hero-header__dates">
            {format(firstDate, 'MMMM d')} — {format(lastDate, 'MMMM d, yyyy')}
          </p>
        </div>

        <div className="dashboard-body">
          {/* Hero Stats — large feature numbers */}
          <div className="dashboard-hero-stats">
            <div className="dashboard-hero-stat dashboard-hero-stat--featured">
              <span className="dashboard-hero-stat__value">{Math.round(totalDistance).toLocaleString()}</span>
              <span className="dashboard-hero-stat__unit">km</span>
              <span className="dashboard-hero-stat__label">traveled</span>
            </div>
            <div className="dashboard-hero-stat__grid">
              <div className="dashboard-hero-stat dashboard-hero-stat--small">
                <span className="dashboard-hero-stat__value">{cityCount}</span>
                <span className="dashboard-hero-stat__label">cities</span>
              </div>
              <div className="dashboard-hero-stat dashboard-hero-stat--small">
                <span className="dashboard-hero-stat__value">{countryCount}</span>
                <span className="dashboard-hero-stat__label">countries</span>
              </div>
              <div className="dashboard-hero-stat dashboard-hero-stat--small">
                <span className="dashboard-hero-stat__value">{entries.length}</span>
                <span className="dashboard-hero-stat__label">entries</span>
              </div>
              <div className="dashboard-hero-stat dashboard-hero-stat--small">
                <span className="dashboard-hero-stat__value">{tripDays}</span>
                <span className="dashboard-hero-stat__label">days</span>
              </div>
            </div>
          </div>

          {/* Ornamental divider */}
          <div className="dashboard-divider" />

          {/* Route Timeline */}
          <div className="dashboard-section" style={{ animationDelay: '0.1s' }}>
            <h3 className="dashboard-section__title">
              <Navigation size={14} />
              <span>Route</span>
            </h3>
            <div className="dashboard-timeline">
              {entries.map((entry, i) => {
                const city = cityName(entry);
                const color = getMoodColor(entry.mood, entry.moodColor);
                const showCity = i === 0 || cityName(entries[i - 1]) !== city;
                const isFirst = i === 0;
                const isLast = i === entries.length - 1;
                return (
                  <div
                    className={`dashboard-timeline__stop ${isFirst ? 'dashboard-timeline__stop--first' : ''} ${isLast ? 'dashboard-timeline__stop--last' : ''}`}
                    key={entry.id}
                  >
                    {i > 0 && <div className="dashboard-timeline__connector" />}
                    <div
                      className="dashboard-timeline__dot"
                      style={{ '--dot-color': color } as React.CSSProperties}
                    />
                    {showCity && (
                      <span className="dashboard-timeline__label">{city}</span>
                    )}
                    {showCity && (
                      <span className="dashboard-timeline__date">
                        {format(new Date(getEntryDisplayDate(entry)), 'MMM d')}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="dashboard-divider" />

          {/* Mood Arc — gradient bar */}
          <div className="dashboard-section" style={{ animationDelay: '0.15s' }}>
            <h3 className="dashboard-section__title">
              <Heart size={14} />
              <span>Emotional Arc</span>
            </h3>
            <div className="dashboard-mood-arc">
              <div
                className="dashboard-mood-arc__bar"
                style={{ background: `linear-gradient(to right, ${moodGradient})` }}
              />
              <div className="dashboard-mood-arc__entries">
                {entries.map((entry, i) => {
                  const color = getMoodColor(entry.mood, entry.moodColor);
                  const pct = entries.length <= 1 ? 50 : (i / (entries.length - 1)) * 100;
                  return (
                    <div
                      className="dashboard-mood-arc__marker"
                      key={entry.id}
                      style={{ left: `${pct}%`, '--marker-color': color } as React.CSSProperties}
                      title={`${cityName(entry)}: ${entry.mood || 'no mood'}`}
                    />
                  );
                })}
              </div>
              <div className="dashboard-mood-arc__labels">
                <span>{format(firstDate, 'MMM d')}</span>
                <span>{format(lastDate, 'MMM d')}</span>
              </div>
            </div>
          </div>

          <div className="dashboard-divider" />

          {/* Countries & Cities */}
          <div className="dashboard-section" style={{ animationDelay: '0.2s' }}>
            <h3 className="dashboard-section__title">
              <Globe size={14} />
              <span>Places</span>
            </h3>
            <div className="dashboard-places">
              {countryList.map(([country, count], ci) => (
                <div className="dashboard-country" key={country} style={{ animationDelay: `${0.25 + ci * 0.08}s` }}>
                  <div className="dashboard-country__header">
                    <span className="dashboard-country__flag">{getFlag(country)}</span>
                    <span className="dashboard-country__name">{country}</span>
                    <span className="dashboard-country__count">{count}</span>
                  </div>
                  <div className="dashboard-country__cities">
                    {Object.entries(cityEntries)
                      .filter(([, v]) => v.country === country)
                      .map(([city, v]) => (
                        <span className="dashboard-city-chip" key={city}>
                          <MapPin size={10} />
                          {city}
                          {v.count > 1 && <span className="dashboard-city-chip__count">{v.count}</span>}
                        </span>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="dashboard-divider" />

          {/* Superlatives */}
          <div className="dashboard-section" style={{ animationDelay: '0.3s' }}>
            <h3 className="dashboard-section__title">
              <Trophy size={14} />
              <span>Highlights</span>
            </h3>
            <div className="dashboard-superlatives">
              {longestLeg && (
                <div className="dashboard-fact">
                  <div className="dashboard-fact__icon"><Route size={18} /></div>
                  <div className="dashboard-fact__body">
                    <span className="dashboard-fact__label">Longest leg</span>
                    <span className="dashboard-fact__value">
                      {Math.round(longestLeg.km).toLocaleString()} km
                    </span>
                    <span className="dashboard-fact__detail">
                      {cityName(longestLeg.from)} <ArrowRight size={10} /> {cityName(longestLeg.to)}
                    </span>
                  </div>
                </div>
              )}
              {shortestLeg && (
                <div className="dashboard-fact">
                  <div className="dashboard-fact__icon"><MapPin size={18} /></div>
                  <div className="dashboard-fact__body">
                    <span className="dashboard-fact__label">Shortest hop</span>
                    <span className="dashboard-fact__value">
                      {shortestLeg.km < 1 ? `${Math.round(shortestLeg.km * 1000)} m` : `${Math.round(shortestLeg.km)} km`}
                    </span>
                    <span className="dashboard-fact__detail">
                      {cityName(shortestLeg.from)} <ArrowRight size={10} /> {cityName(shortestLeg.to)}
                    </span>
                  </div>
                </div>
              )}
              {mostVisitedCity && (
                <div className="dashboard-fact">
                  <div className="dashboard-fact__icon"><BookOpen size={18} /></div>
                  <div className="dashboard-fact__body">
                    <span className="dashboard-fact__label">Most visited</span>
                    <span className="dashboard-fact__value">{mostVisitedCity[0]}</span>
                    <span className="dashboard-fact__detail">{mostVisitedCity[1].count} entries</span>
                  </div>
                </div>
              )}
              {topMood && (
                <div className="dashboard-fact">
                  <div className="dashboard-fact__icon"><Heart size={18} /></div>
                  <div className="dashboard-fact__body">
                    <span className="dashboard-fact__label">Most felt</span>
                    <span className="dashboard-fact__value" style={{ textTransform: 'capitalize' }}>{topMood[0]}</span>
                    <span className="dashboard-fact__detail">{topMood[1]} times</span>
                  </div>
                </div>
              )}
              {totalPhotos > 0 && (
                <div className="dashboard-fact">
                  <div className="dashboard-fact__icon"><Camera size={18} /></div>
                  <div className="dashboard-fact__body">
                    <span className="dashboard-fact__label">Photos captured</span>
                    <span className="dashboard-fact__value">{totalPhotos}</span>
                  </div>
                </div>
              )}
              {headlineCount > 0 && (
                <div className="dashboard-fact">
                  <div className="dashboard-fact__icon"><Newspaper size={18} /></div>
                  <div className="dashboard-fact__body">
                    <span className="dashboard-fact__label">News dispatches</span>
                    <span className="dashboard-fact__value">{headlineCount}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer ornament */}
          <div className="dashboard-footer-ornament">
            <svg viewBox="0 0 200 30" className="dashboard-ornament-svg">
              <path d="M20,15 L90,15 M110,15 L180,15" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
              <circle cx="100" cy="15" r="3" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.4" />
              <circle cx="100" cy="15" r="6" fill="none" stroke="currentColor" strokeWidth="0.3" opacity="0.2" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
