import { useState, useEffect } from 'react';
import {
  Plus, Settings, Upload, Loader2, BookOpen, MapPin,
  Calendar, Eye, Pencil, Trash2, Globe, AlertTriangle, Sun, Moon,
  RefreshCw
} from 'lucide-react';
import { useJournalStore, getEntryDisplayDate } from '../store/journalStore';
import { format } from 'date-fns';
import NewEntry from './NewEntry';
import SettingsPanel from './Settings';
import type { JournalEntry } from '../types';

export default function AuthorView() {
  const {
    entries, isPublishing, isLoading, loadEntries, publish, deleteEntry, flyToEntry,
    setViewMode, settings, setTheme, syncEntries
  } = useJournalStore();
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | undefined>();
  const [publishResult, setPublishResult] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // Sort entries by display date (newest first)
  const sortedEntries = [...entries].sort(
    (a, b) =>
      new Date(getEntryDisplayDate(b)).getTime() -
      new Date(getEntryDisplayDate(a)).getTime()
  );

  const handlePublish = async () => {
    const success = await publish();
    setPublishResult(success ? 'Published successfully!' : 'Failed to publish. Check settings.');
    setTimeout(() => setPublishResult(null), 3000);
  };

  const handleSync = async () => {
    setIsSyncing(true);
    await syncEntries();
    setIsSyncing(false);
  };

  const handleEdit = (entry: JournalEntry) => {
    setEditingEntry(entry);
    setShowNewEntry(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this entry? This cannot be undone.')) {
      await deleteEntry(id);
    }
  };

  const handleViewOnMap = (entry: JournalEntry) => {
    flyToEntry(entry);
    setViewMode('reader');
  };

  const publishedCount = entries.filter((e) => e.isPublished).length;
  const draftCount = entries.filter((e) => !e.isPublished).length;

  return (
    <div className="author-view">
      <div className="author-header">
        <div className="author-title-row">
          <h1>My Journal</h1>
          <div className="author-header-actions">
            <button
              className="btn-icon"
              onClick={() => setTheme(settings.theme === 'light' ? 'dark' : 'light')}
              title={settings.theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            >
              {settings.theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>
            <button className="btn-icon" onClick={() => setViewMode('reader')} title="Reader view">
              <Eye size={20} />
            </button>
            <button className="btn-icon" onClick={() => setShowSettings(true)} title="Settings">
              <Settings size={20} />
            </button>
          </div>
        </div>
        <div className="author-stats">
          <div className="stat">
            <BookOpen size={14} />
            <span>{entries.length} entries</span>
          </div>
          <div className="stat">
            <Globe size={14} />
            <span>{publishedCount} published</span>
          </div>
          <div className="stat">
            <Pencil size={14} />
            <span>{draftCount} drafts</span>
          </div>
        </div>
      </div>

      <div className="author-actions-bar">
        <button className="btn btn-primary" onClick={() => { setEditingEntry(undefined); setShowNewEntry(true); }}>
          <Plus size={18} />
          <span>New Entry</span>
        </button>
        <button
          className="btn btn-secondary"
          onClick={handleSync}
          disabled={isSyncing || isLoading}
          title="Pull entries from other devices"
        >
          {isSyncing ? <Loader2 size={18} className="spin" /> : <RefreshCw size={18} />}
          <span>Sync</span>
        </button>
        <button
          className="btn btn-secondary"
          onClick={handlePublish}
          disabled={isPublishing || publishedCount === 0}
        >
          {isPublishing ? <Loader2 size={18} className="spin" /> : <Upload size={18} />}
          <span>Publish All</span>
        </button>
      </div>

      {/* GitHub not configured banner */}
      {!settings.githubToken && (
        <div className="setup-banner" onClick={() => setShowSettings(true)}>
          <div className="setup-banner-icon">
            <AlertTriangle size={18} />
          </div>
          <div className="setup-banner-text">
            <strong>GitHub not connected</strong>
            <span>Your entries are saved locally on this device only. Connect GitHub in Settings to share your journal with others and sync across devices.</span>
          </div>
        </div>
      )}

      {publishResult && (
        <div className={`toast ${publishResult.includes('success') ? 'toast-success' : 'toast-error'}`}>
          {publishResult}
        </div>
      )}

      <div className="entries-list">
        {entries.length === 0 ? (
          <div className="empty-state">
            <MapPin size={48} />
            <h3>No entries yet</h3>
            <p>Tap "New Entry" to start documenting your journey</p>
          </div>
        ) : (
          sortedEntries.map((entry) => (
            <div key={entry.id} className="entry-card" onClick={() => handleViewOnMap(entry)}>
              <div className="entry-card-header">
                <div className="entry-card-date">
                  <Calendar size={14} />
                  <span>{format(new Date(getEntryDisplayDate(entry)), 'EEEE, MMMM d, yyyy')}</span>
                </div>
                <div className={`entry-status ${entry.isPublished ? 'published' : 'draft'}`}>
                  {entry.isPublished ? 'Published' : 'Draft'}
                </div>
              </div>

              <h3 className="entry-card-title">{entry.title}</h3>

              <div className="entry-card-location">
                <MapPin size={12} />
                <span>{entry.location.city || entry.location.placeName || 'Unknown location'}</span>
                {entry.location.country && <span> · {entry.location.country}</span>}
              </div>

              <p className="entry-card-preview">
                {entry.content.slice(0, 150)}{entry.content.length > 150 ? '...' : ''}
              </p>

              {entry.photos.some((p) => p.dataUrl || p.remoteUrl) && (
                <div className="entry-card-photos">
                  {entry.photos.filter((p) => p.dataUrl || p.remoteUrl).slice(0, 3).map((p) => (
                    <img key={p.id} src={p.dataUrl || p.remoteUrl} alt="" className="entry-card-photo-thumb" />
                  ))}
                  {entry.photos.filter((p) => p.dataUrl || p.remoteUrl).length > 3 && (
                    <div className="entry-card-photo-more">+{entry.photos.filter((p) => p.dataUrl || p.remoteUrl).length - 3}</div>
                  )}
                </div>
              )}

              <div className="entry-card-footer">
                {entry.mood && (
                  <span className="entry-card-mood">{entry.mood}</span>
                )}
                <div className="entry-card-actions" onClick={(e) => e.stopPropagation()}>
                  <button className="btn-icon-sm" onClick={() => handleEdit(entry)} title="Edit">
                    <Pencil size={14} />
                  </button>
                  <button className="btn-icon-sm btn-danger" onClick={() => handleDelete(entry.id)} title="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showNewEntry && (
        <NewEntry
          onClose={() => { setShowNewEntry(false); setEditingEntry(undefined); }}
          editEntry={editingEntry}
        />
      )}

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  );
}
