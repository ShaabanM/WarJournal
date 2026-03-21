import { X, MapPin, Globe, Route, BookOpen, Camera, Newspaper, Heart, Trophy, ArrowRight } from 'lucide-react';
import { useSortedEntries, getEntryDisplayDate } from '../store/journalStore';
import { calculateDistance } from '../utils/geo';
import { getMoodColor } from '../utils/sentiment';
import { format } from 'date-fns';
import type { JournalEntry } from '../types';

// Country code → flag emoji mapping for known countries
const COUNTRY_FLAGS: Record<string, string> = {
  'United Arab Emirates': '🇦🇪',
  'Italy': '🇮🇹',
  'Hungary': '🇭🇺',
  'France': '🇫🇷',
  'Germany': '🇩🇪',
  'Spain': '🇪🇸',
  'United Kingdom': '🇬🇧',
  'United States': '🇺🇸',
  'Turkey': '🇹🇷',
  'Egypt': '🇪🇬',
  'Greece': '🇬🇷',
  'Switzerland': '🇨🇭',
  'Austria': '🇦🇹',
  'Netherlands': '🇳🇱',
  'Czech Republic': '🇨🇿',
  'Czechia': '🇨🇿',
  'Poland': '🇵🇱',
  'Portugal': '🇵🇹',
  'Croatia': '🇭🇷',
  'Japan': '🇯🇵',
  'India': '🇮🇳',
  'Thailand': '🇹🇭',
};

function getFlag(country: string): string {
  return COUNTRY_FLAGS[country] || '🌍';
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

  // City stats — group by exact city name (no distance clustering)
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

  // Photo count
  const totalPhotos = entries.reduce((sum, e) => sum + (e.photos?.length || 0), 0);

  // News headline count
  const headlineCount = entries.filter((e) => e.newsHeadline).length;

  // City name helper
  const cityName = (e: JournalEntry) => e.location.city || e.location.placeName || '?';

  return (
    <div className="dashboard-overlay" onClick={onClose}>
      <div className="dashboard-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="dashboard-header">
          <div className="dashboard-header__title">
            <Globe size={20} />
            <h2>Your Journey</h2>
          </div>
          <button className="btn-icon-sm" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="dashboard-body">
          {/* Hero Stats */}
          <div className="dashboard-hero">
            <div className="dashboard-hero-stat">
              <span className="dashboard-hero-stat__value">{Math.round(totalDistance).toLocaleString()}</span>
              <span className="dashboard-hero-stat__label">kilometers</span>
            </div>
            <div className="dashboard-hero-stat">
              <span className="dashboard-hero-stat__value">{cityCount}</span>
              <span className="dashboard-hero-stat__label">cities</span>
            </div>
            <div className="dashboard-hero-stat">
              <span className="dashboard-hero-stat__value">{countryCount}</span>
              <span className="dashboard-hero-stat__label">countries</span>
            </div>
            <div className="dashboard-hero-stat">
              <span className="dashboard-hero-stat__value">{entries.length}</span>
              <span className="dashboard-hero-stat__label">entries</span>
            </div>
            <div className="dashboard-hero-stat">
              <span className="dashboard-hero-stat__value">{tripDays}</span>
              <span className="dashboard-hero-stat__label">days</span>
            </div>
          </div>

          {/* Date range subtitle */}
          <p className="dashboard-daterange">
            {format(firstDate, 'MMM d')} — {format(lastDate, 'MMM d, yyyy')}
          </p>

          {/* Route Timeline */}
          <div className="dashboard-section" style={{ animationDelay: '0.1s' }}>
            <h3 className="dashboard-section__title">
              <Route size={15} />
              Route
            </h3>
            <div className="dashboard-timeline">
              {entries.map((entry, i) => {
                const city = cityName(entry);
                const color = getMoodColor(entry.mood, entry.moodColor);
                const showCity = i === 0 || cityName(entries[i - 1]) !== city;
                return (
                  <div className="dashboard-timeline__stop" key={entry.id}>
                    <div className="dashboard-timeline__dot" style={{ background: color }} />
                    {i < entries.length - 1 && <div className="dashboard-timeline__line" />}
                    {showCity && (
                      <span className="dashboard-timeline__label">{city}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Countries & Cities */}
          <div className="dashboard-section" style={{ animationDelay: '0.2s' }}>
            <h3 className="dashboard-section__title">
              <MapPin size={15} />
              Places
            </h3>
            <div className="dashboard-places">
              {countryList.map(([country, count]) => (
                <div className="dashboard-country" key={country}>
                  <div className="dashboard-country__header">
                    <span className="dashboard-country__flag">{getFlag(country)}</span>
                    <span className="dashboard-country__name">{country}</span>
                    <span className="dashboard-country__count">{count} {count === 1 ? 'entry' : 'entries'}</span>
                  </div>
                  <div className="dashboard-country__cities">
                    {Object.entries(cityEntries)
                      .filter(([, v]) => v.country === country)
                      .map(([city, v]) => (
                        <span className="dashboard-city-chip" key={city}>
                          {city}
                          {v.count > 1 && <span className="dashboard-city-chip__count">{v.count}</span>}
                        </span>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Superlatives */}
          <div className="dashboard-section" style={{ animationDelay: '0.3s' }}>
            <h3 className="dashboard-section__title">
              <Trophy size={15} />
              Highlights
            </h3>
            <div className="dashboard-superlatives">
              {longestLeg && (
                <div className="dashboard-fact">
                  <div className="dashboard-fact__icon"><Route size={16} /></div>
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
                  <div className="dashboard-fact__icon"><MapPin size={16} /></div>
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
                  <div className="dashboard-fact__icon"><BookOpen size={16} /></div>
                  <div className="dashboard-fact__body">
                    <span className="dashboard-fact__label">Most visited</span>
                    <span className="dashboard-fact__value">{mostVisitedCity[0]}</span>
                    <span className="dashboard-fact__detail">{mostVisitedCity[1].count} entries</span>
                  </div>
                </div>
              )}
              {topMood && (
                <div className="dashboard-fact">
                  <div className="dashboard-fact__icon"><Heart size={16} /></div>
                  <div className="dashboard-fact__body">
                    <span className="dashboard-fact__label">Most felt</span>
                    <span className="dashboard-fact__value" style={{ textTransform: 'capitalize' }}>{topMood[0]}</span>
                    <span className="dashboard-fact__detail">{topMood[1]} times</span>
                  </div>
                </div>
              )}
              {totalPhotos > 0 && (
                <div className="dashboard-fact">
                  <div className="dashboard-fact__icon"><Camera size={16} /></div>
                  <div className="dashboard-fact__body">
                    <span className="dashboard-fact__label">Photos captured</span>
                    <span className="dashboard-fact__value">{totalPhotos}</span>
                  </div>
                </div>
              )}
              {headlineCount > 0 && (
                <div className="dashboard-fact">
                  <div className="dashboard-fact__icon"><Newspaper size={16} /></div>
                  <div className="dashboard-fact__body">
                    <span className="dashboard-fact__label">News dispatches</span>
                    <span className="dashboard-fact__value">{headlineCount}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mood Arc */}
          <div className="dashboard-section" style={{ animationDelay: '0.4s' }}>
            <h3 className="dashboard-section__title">
              <Heart size={15} />
              Mood Arc
            </h3>
            <div className="dashboard-mood-arc">
              {entries.map((entry) => {
                const color = getMoodColor(entry.mood, entry.moodColor);
                return (
                  <div
                    className="dashboard-mood-arc__dot"
                    key={entry.id}
                    style={{ background: color }}
                    title={`${cityName(entry)}: ${entry.mood || 'no mood'}`}
                  />
                );
              })}
            </div>
            {entries.some((e) => e.mood) && (
              <div className="dashboard-mood-arc__labels">
                <span>{format(firstDate, 'MMM d')}</span>
                <span>{format(lastDate, 'MMM d')}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
