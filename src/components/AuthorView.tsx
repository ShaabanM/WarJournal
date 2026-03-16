import { startTransition, useDeferredValue, useEffect, useState } from 'react';
import {
  BookOpenText,
  Clock3,
  Eye,
  ExternalLink,
  Globe,
  Image as ImageIcon,
  Loader2,
  Lock,
  Pencil,
  Plus,
  RadioTower,
  Search,
  Settings,
  Trash2,
  Upload,
} from 'lucide-react';
import { format } from 'date-fns';
import { useJournalStore } from '../store/journalStore';
import NewEntry from './NewEntry';
import SettingsPanel from './Settings';
import type { JournalEntry } from '../types';
import { getMoodMeta } from '../constants/moods';
import {
  getDraftCount,
  getExcerpt,
  getLatestEntry,
  getLocationLabel,
  getPublishedCount,
  getReadingTimeMinutes,
  getRelativeTimestampLabel,
  getTotalPhotos,
  getTotalWordCount,
} from '../utils/journal';

type EntryFilter = 'all' | 'draft' | 'published';
type SortMode = 'newest' | 'oldest';

interface AuthorViewProps {
  onLock: () => void;
}

export default function AuthorView({ onLock }: AuthorViewProps) {
  const {
    entries,
    isPublishing,
    loadEntries,
    publish,
    deleteEntry,
    previewEntryOnMap,
    setViewMode,
    settings,
  } = useJournalStore();
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | undefined>();
  const [publishResult, setPublishResult] = useState<string | null>(null);
  const [entryFilter, setEntryFilter] = useState<EntryFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearch = useDeferredValue(searchQuery);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const handlePublish = async () => {
    const readyToPublish = Boolean(
      settings.githubToken && settings.githubOwner && settings.githubRepo
    );

    if (!readyToPublish) {
      setShowSettings(true);
      setPublishResult('Connect GitHub in Settings before publishing to your public journal.');
      window.setTimeout(() => setPublishResult(null), 4000);
      return;
    }

    const success = await publish();
    setPublishResult(
      success
        ? 'Published successfully. Your public journal will update once GitHub Pages finishes rebuilding.'
        : 'Publishing failed. Check your GitHub settings and token scope.'
    );
    window.setTimeout(() => setPublishResult(null), 4000);
  };

  const handleEdit = (entry: JournalEntry) => {
    setEditingEntry(entry);
    setShowNewEntry(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Delete this entry? This cannot be undone.')) {
      await deleteEntry(id);
    }
  };

  const handleViewOnMap = (entry: JournalEntry) => {
    previewEntryOnMap(entry);
    setViewMode('reader');
  };

  const normalizedQuery = deferredSearch.trim().toLowerCase();
  const filteredEntries = entries
    .filter((entry) => {
      if (entryFilter === 'draft' && entry.isPublished) return false;
      if (entryFilter === 'published' && !entry.isPublished) return false;
      if (!normalizedQuery) return true;

      return [
        entry.title,
        entry.content,
        entry.location.city,
        entry.location.country,
        entry.location.placeName,
        ...entry.tags,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedQuery));
    })
    .sort((a, b) =>
      sortMode === 'newest'
        ? new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        : new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

  const publishedCount = getPublishedCount(entries);
  const draftCount = getDraftCount(entries);
  const totalPhotos = getTotalPhotos(entries);
  const totalWords = getTotalWordCount(entries);
  const latestEntry = getLatestEntry(entries);
  const publicUrl =
    settings.githubOwner && settings.githubRepo
      ? `https://${settings.githubOwner}.github.io/${settings.githubRepo}/`
      : null;

  const heroCards = [
    {
      label: 'Drafts waiting',
      value: `${draftCount}`,
      description: draftCount === 1 ? 'One entry still private' : 'Entries still private',
    },
    {
      label: 'Published',
      value: `${publishedCount}`,
      description: publishedCount > 0 ? 'Visible to readers' : 'Nothing public yet',
    },
    {
      label: 'Story volume',
      value: `${totalWords.toLocaleString()} words`,
      description: `${totalPhotos} attached photo${totalPhotos === 1 ? '' : 's'}`,
    },
  ];

  const entryCountLabel =
    filteredEntries.length === entries.length
      ? `${entries.length} entries`
      : `${filteredEntries.length} of ${entries.length} entries`;

  return (
    <div className="author-view">
      <div className="author-shell">
        <header className="author-header">
          <div>
            <p className="eyebrow">Author desk</p>
            <h1>{settings.journalTitle || 'War Journal'}</h1>
            <p className="author-subtitle">
              {settings.journalSubtitle || 'Shape the public story, manage drafts, and publish with confidence.'}
            </p>
          </div>

          <div className="author-header-actions">
            {publicUrl ? (
              <button
                className="btn btn-ghost"
                onClick={() => window.open(publicUrl, '_blank', 'noopener,noreferrer')}
              >
                <ExternalLink size={16} />
                <span>Open Public Journal</span>
              </button>
            ) : null}
            <button className="btn btn-ghost" onClick={() => setViewMode('reader')}>
              <Eye size={16} />
              <span>Reader View</span>
            </button>
            {settings.authorPin ? (
              <button className="btn btn-ghost" onClick={onLock}>
                <Lock size={16} />
                <span>Lock Desk</span>
              </button>
            ) : null}
            <button className="btn-icon" onClick={() => setShowSettings(true)} title="Settings">
              <Settings size={20} />
            </button>
          </div>
        </header>

        <section className="author-hero">
          <div className="author-hero-main">
            <div className="author-hero-copy">
              <p className="eyebrow">Mission control</p>
              <h2>Keep the journal beautiful, current, and ready to publish.</h2>
              <p>
                Create new dispatches quickly, recover drafts safely, and keep the public map aligned with what you actually want readers to see.
              </p>
            </div>

            <div className="author-hero-actions">
              <button
                className="btn btn-primary"
                onClick={() => {
                  setEditingEntry(undefined);
                  setShowNewEntry(true);
                }}
              >
                <Plus size={18} />
                <span>New Dispatch</span>
              </button>
              <button
                className="btn btn-secondary"
                onClick={handlePublish}
                disabled={isPublishing || publishedCount === 0}
              >
                {isPublishing ? <Loader2 size={18} className="spin" /> : <Upload size={18} />}
                <span>{isPublishing ? 'Publishing...' : 'Publish Public Story'}</span>
              </button>
            </div>
          </div>

          <div className="author-hero-stats">
            {heroCards.map((card) => (
              <div key={card.label} className="metric-card">
                <span className="metric-label">{card.label}</span>
                <strong>{card.value}</strong>
                <p>{card.description}</p>
              </div>
            ))}
          </div>
        </section>

        {publishResult ? (
          <div
            className={`toast ${
              publishResult.toLowerCase().includes('success') ? 'toast-success' : 'toast-info'
            }`}
          >
            {publishResult}
          </div>
        ) : null}

        <section className="author-toolbar">
          <div className="author-search">
            <Search size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                const nextValue = e.target.value;
                startTransition(() => {
                  setSearchQuery(nextValue);
                });
              }}
              placeholder="Search entries, places, tags, or what happened..."
            />
          </div>

          <div className="author-filter-pills">
            {[
              { value: 'all', label: 'All entries' },
              { value: 'draft', label: 'Drafts' },
              { value: 'published', label: 'Published' },
            ].map((option) => (
              <button
                key={option.value}
                className={`filter-pill ${entryFilter === option.value ? 'active' : ''}`}
                onClick={() => setEntryFilter(option.value as EntryFilter)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <label className="author-sort">
            <span>Sort</span>
            <select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </label>
        </section>

        {!settings.githubToken ? (
          <div className="setup-banner" onClick={() => setShowSettings(true)}>
            <div className="setup-banner-icon">
              <RadioTower size={18} />
            </div>
            <div className="setup-banner-text">
              <strong>Publishing is not connected yet</strong>
              <span>
                Drafts are safe on this device, but your public journal will not update until GitHub is configured.
              </span>
            </div>
          </div>
        ) : null}

        <div className="author-content">
          <section className="author-main">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Dispatch library</p>
                <h3>{entryCountLabel}</h3>
              </div>
              {latestEntry ? (
                <p className="section-meta">
                  Last entry {getRelativeTimestampLabel(latestEntry.timestamp)}
                </p>
              ) : null}
            </div>

            {filteredEntries.length === 0 ? (
              <div className="empty-state empty-state-rich">
                <BookOpenText size={48} />
                <h3>No entries match this view</h3>
                <p>
                  {entries.length === 0
                    ? 'Start with your first dispatch and the dashboard will grow around it.'
                    : 'Try changing the search or filters to bring entries back into view.'}
                </p>
                {entries.length === 0 ? (
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setEditingEntry(undefined);
                      setShowNewEntry(true);
                    }}
                  >
                    <Plus size={16} />
                    <span>Write First Dispatch</span>
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="entries-grid">
                {filteredEntries.map((entry) => {
                  const mood = getMoodMeta(entry.mood);
                  return (
                    <article key={entry.id} className="entry-card">
                      <button className="entry-card-hitbox" onClick={() => handleViewOnMap(entry)} />

                      <div className="entry-card-header">
                        <div className="entry-card-date">
                          <Clock3 size={14} />
                          <span>{format(new Date(entry.timestamp), 'EEEE, MMM d, yyyy · p')}</span>
                        </div>
                        <div className={`entry-status ${entry.isPublished ? 'published' : 'draft'}`}>
                          {entry.isPublished ? 'Published' : 'Draft'}
                        </div>
                      </div>

                      <div className="entry-card-body">
                        <h3 className="entry-card-title">{entry.title}</h3>
                        <p className="entry-card-location">{getLocationLabel(entry.location)}</p>
                        <p className="entry-card-preview">{getExcerpt(entry.content, 148)}</p>
                      </div>

                      {entry.photos.length > 0 ? (
                        <div className="entry-card-photos">
                          {entry.photos.slice(0, 3).map((photo) => (
                            <img
                              key={photo.id}
                              src={photo.dataUrl}
                              alt=""
                              className="entry-card-photo-thumb"
                            />
                          ))}
                          {entry.photos.length > 3 ? (
                            <div className="entry-card-photo-more">+{entry.photos.length - 3}</div>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="entry-card-footer">
                        <div className="entry-card-meta">
                          {mood ? (
                            <span className="entry-card-mood" style={{ '--mood-color': mood.color } as React.CSSProperties}>
                              {mood.emoji} {mood.label}
                            </span>
                          ) : (
                            <span className="entry-card-muted">No mood set</span>
                          )}
                          <span className="entry-card-muted">
                            {getReadingTimeMinutes(entry.content)} min read
                          </span>
                          <span className="entry-card-muted">
                            <ImageIcon size={12} />
                            {entry.photos.length}
                          </span>
                        </div>

                        <div className="entry-card-actions">
                          <button className="btn-icon-sm" onClick={() => handleEdit(entry)} title="Edit entry">
                            <Pencil size={14} />
                          </button>
                          <button
                            className="btn-icon-sm btn-danger"
                            onClick={() => handleDelete(entry.id)}
                            title="Delete entry"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="author-sidebar">
            <div className="dashboard-card">
              <div className="dashboard-card-header">
                <h3>Publishing readiness</h3>
                <Globe size={16} />
              </div>
              <ul className="status-list">
                <li className={settings.authorPin ? 'good' : 'warn'}>
                  {settings.authorPin ? 'Author desk is protected with a PIN' : 'Author desk is unlocked'}
                </li>
                <li className={settings.githubToken ? 'good' : 'warn'}>
                  {settings.githubToken ? 'GitHub token is configured' : 'GitHub token missing'}
                </li>
                <li className={publicUrl ? 'good' : 'warn'}>
                  {publicUrl ? 'Public URL can be generated from your repo settings' : 'Public URL is not ready yet'}
                </li>
              </ul>
              {settings.lastPublishedAt ? (
                <p className="dashboard-hint">
                  Last successful publish {getRelativeTimestampLabel(settings.lastPublishedAt)}.
                </p>
              ) : (
                <p className="dashboard-hint">No successful publish has been recorded yet.</p>
              )}
            </div>

            <div className="dashboard-card">
              <div className="dashboard-card-header">
                <h3>Journey footprint</h3>
                <BookOpenText size={16} />
              </div>
              <div className="dashboard-metrics">
                <div>
                  <strong>{entries.length}</strong>
                  <span>entries</span>
                </div>
                <div>
                  <strong>{totalPhotos}</strong>
                  <span>photos</span>
                </div>
                <div>
                  <strong>{Math.max(1, Math.round(totalWords / 200))}</strong>
                  <span>reading minutes</span>
                </div>
              </div>
            </div>

            {latestEntry ? (
              <div className="dashboard-card latest-card">
                <div className="dashboard-card-header">
                  <h3>Latest dispatch</h3>
                  <Clock3 size={16} />
                </div>
                <strong>{latestEntry.title}</strong>
                <p>{getExcerpt(latestEntry.content, 120)}</p>
                <button className="btn btn-ghost" onClick={() => handleViewOnMap(latestEntry)}>
                  <Eye size={16} />
                  <span>Open On Map</span>
                </button>
              </div>
            ) : null}
          </aside>
        </div>
      </div>

      {showNewEntry ? (
        <NewEntry
          onClose={() => {
            setShowNewEntry(false);
            setEditingEntry(undefined);
          }}
          editEntry={editingEntry}
        />
      ) : null}

      {showSettings ? <SettingsPanel onClose={() => setShowSettings(false)} /> : null}
    </div>
  );
}
