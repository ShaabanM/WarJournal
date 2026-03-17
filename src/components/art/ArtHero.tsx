import { format } from 'date-fns';
import { getEntryDisplayDate } from '../../store/journalStore';
import { getTotalDistance } from '../../utils/geo';
import type { JournalEntry } from '../../types';

interface ArtHeroProps {
  entries: JournalEntry[];
}

export default function ArtHero({ entries }: ArtHeroProps) {
  // Compute stats
  const totalDistance =
    entries.length > 1
      ? getTotalDistance(entries.map((e) => e.location))
      : 0;

  const countries = new Set(
    entries.map((e) => e.location.country).filter(Boolean)
  );

  // City clusters (~25km radius)
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
      if (!nearby) {
        clusters.push({ lat: e.location.lat, lng: e.location.lng });
      }
    }
    return clusters;
  })();

  const dateRange =
    entries.length > 0
      ? (() => {
          const first = new Date(getEntryDisplayDate(entries[0]));
          const last = new Date(
            getEntryDisplayDate(entries[entries.length - 1])
          );
          return `${format(first, 'MMM d')} — ${format(last, 'MMM d, yyyy')}`;
        })()
      : '';

  return (
    <section className="art-hero">
      <div className="art-hero__bg" />

      <div className="art-hero__content" data-reveal>
        <span className="art-hero__label">A Journey Through Conflict</span>
        <h1 className="art-hero__title">War Journal</h1>
        <p className="art-hero__subtitle">
          Told one day at a time
        </p>

        {entries.length > 0 && (
          <div className="art-hero__stats" data-reveal>
            <span className="art-hero__stat">
              <strong>{dateRange}</strong>
            </span>
            <span className="art-hero__stat">
              <strong>{cities.length}</strong> cities
            </span>
            <span className="art-hero__stat">
              <strong>{countries.size}</strong> countries
            </span>
            {totalDistance > 0 && (
              <span className="art-hero__stat">
                <strong>{Math.round(totalDistance).toLocaleString()}</strong> km
              </span>
            )}
          </div>
        )}
      </div>

      <div className="art-hero__scroll-cue">
        <span>Scroll to begin</span>
        <div className="art-hero__chevron" />
      </div>
    </section>
  );
}
