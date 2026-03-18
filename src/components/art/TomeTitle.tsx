import { format } from 'date-fns';
import { getEntryDisplayDate } from '../../store/journalStore';
import { getTotalDistance } from '../../utils/geo';
import type { JournalEntry } from '../../types';

interface TomeTitleProps {
  entries: JournalEntry[];
}

export default function TomeTitle({ entries }: TomeTitleProps) {
  const totalDistance =
    entries.length > 1 ? getTotalDistance(entries.map((e) => e.location)) : 0;

  const countries = new Set(entries.map((e) => e.location.country).filter(Boolean));

  const cities = (() => {
    const clusters: { lat: number; lng: number }[] = [];
    for (const e of entries) {
      const name = e.location.city || e.location.placeName || '';
      if (!name) continue;
      const nearby = clusters.find((c) => {
        const dlat = c.lat - e.location.lat;
        const dlng = c.lng - e.location.lng;
        return Math.sqrt(dlat * dlat + dlng * dlng) < 0.25;
      });
      if (!nearby) clusters.push({ lat: e.location.lat, lng: e.location.lng });
    }
    return clusters;
  })();

  const dateRange =
    entries.length > 0
      ? (() => {
          const first = new Date(getEntryDisplayDate(entries[0]));
          const last = new Date(getEntryDisplayDate(entries[entries.length - 1]));
          return `${format(first, 'MMM d')} \u2014 ${format(last, 'MMM d, yyyy')}`;
        })()
      : '';

  return (
    <section className="tome-title-page">
      <div className="tome-title-page__card">
        <p className="tome-title-page__ornament" aria-hidden="true">
          &#x2726;&ensp;&#x2726;&ensp;&#x2726;
        </p>

        <h1 className="tome-title-page__title">War Journal</h1>

        <p className="tome-title-page__subtitle">
          There &amp; Back Again<br />
          <em>A Journey Through Conflict</em>
        </p>

        <p className="tome-title-page__ornament" aria-hidden="true">
          &#x2766;&ensp;&#x2726;&ensp;&#x2767;
        </p>

        {entries.length > 0 && (
          <div className="tome-title-page__stats">
            <span className="tome-title-page__stat">
              <strong>{dateRange}</strong>
            </span>
            <span className="tome-title-page__stat">
              <strong>{cities.length}</strong> cities
            </span>
            <span className="tome-title-page__stat">
              <strong>{countries.size}</strong> countries
            </span>
            {totalDistance > 0 && (
              <span className="tome-title-page__stat">
                <strong>{Math.round(totalDistance).toLocaleString()}</strong> km
              </span>
            )}
          </div>
        )}

        <div className="tome-title-page__scroll-cue">
          <span>Scroll to begin the journey</span>
          <div className="tome-title-page__chevron" />
        </div>
      </div>
    </section>
  );
}
