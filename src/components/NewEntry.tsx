import { useEffect, useState } from 'react';
import {
  Camera,
  ChevronDown,
  Clock3,
  Loader2,
  MapPin,
  Mic,
  MicOff,
  Navigation,
  Save,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { useGeolocation } from '../hooks/useGeolocation';
import { useSpeechToText } from '../hooks/useSpeechToText';
import { useJournalStore } from '../store/journalStore';
import { compressImage, createPhoto } from '../utils/photos';
import { formatCoordinates } from '../utils/geo';
import { MOODS } from '../constants/moods';
import { getReadingTimeMinutes, getWordCount } from '../utils/journal';
import type { JournalEntry, EntryPhoto, GeoLocation } from '../types';

const DRAFT_STORAGE_KEY = 'war-journal-composer-draft';

interface EntryDraftSnapshot {
  title: string;
  content: string;
  mood: string;
  tags: string;
  location: GeoLocation | null;
  timestamp: string;
  savedAt: string;
}

interface NewEntryProps {
  onClose: () => void;
  editEntry?: JournalEntry;
}

export default function NewEntry({ onClose, editEntry }: NewEntryProps) {
  const { addEntry, updateEntry, publish: publishToGithub, settings } = useJournalStore();
  const { isLocating, error: geoError, getLocation } = useGeolocation();
  const {
    text: voiceText,
    isListening,
    isSupported: speechSupported,
    error: speechError,
    startListening,
    stopListening,
    setText: setVoiceText,
  } = useSpeechToText();
  const [initialDraft] = useState<EntryDraftSnapshot | null>(() =>
    editEntry ? null : loadDraftSnapshot()
  );

  const [title, setTitle] = useState(editEntry?.title || initialDraft?.title || '');
  const [content, setContent] = useState(editEntry?.content || initialDraft?.content || '');
  const [mood, setMood] = useState<string>(editEntry?.mood || initialDraft?.mood || '');
  const [photos, setPhotos] = useState<EntryPhoto[]>(editEntry?.photos || []);
  const [tags, setTags] = useState(editEntry?.tags?.join(', ') || initialDraft?.tags || '');
  const [entryLocation, setEntryLocation] = useState<GeoLocation | null>(
    editEntry?.location || initialDraft?.location || null
  );
  const [entryTimestamp, setEntryTimestamp] = useState(
    initialDraft?.timestamp ||
      toDateTimeLocalValue(editEntry?.timestamp || new Date().toISOString())
  );
  const [isSaving, setIsSaving] = useState(false);
  const [showMoodPicker, setShowMoodPicker] = useState(false);
  const [showLocationEditor, setShowLocationEditor] = useState(Boolean(editEntry));
  const [draftRecoveredAt, setDraftRecoveredAt] = useState<string | null>(
    initialDraft?.savedAt || null
  );

  useEffect(() => {
    if (!editEntry && !initialDraft?.location) {
      void getLocation().then((loc) => {
        if (loc) setEntryLocation(loc);
      });
    }
  }, [editEntry, getLocation, initialDraft]);

  useEffect(() => {
    if (editEntry) return;

    const hasMeaningfulDraft = Boolean(
      title.trim() || content.trim() || tags.trim() || mood || entryLocation
    );

    const timeoutId = window.setTimeout(() => {
      if (!hasMeaningfulDraft) {
        window.localStorage.removeItem(DRAFT_STORAGE_KEY);
        return;
      }

      const snapshot: EntryDraftSnapshot = {
        title,
        content,
        mood,
        tags,
        location: entryLocation,
        timestamp: entryTimestamp,
        savedAt: new Date().toISOString(),
      };
      window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(snapshot));
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [content, editEntry, entryLocation, entryTimestamp, mood, tags, title]);

  const handleToggleVoice = () => {
    if (isListening) {
      setContent(voiceText.trim());
      stopListening();
      return;
    }

    setVoiceText(content);
    startListening();
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      try {
        const dataUrl = await compressImage(file);
        const photo = createPhoto(dataUrl);
        setPhotos((prev) => [...prev, photo]);
      } catch (err) {
        console.error('Failed to process photo:', err);
      }
    }
    e.target.value = '';
  };

  const removePhoto = (id: string) => {
    setPhotos((prev) => prev.filter((photo) => photo.id !== id));
  };

  const refreshLocation = async () => {
    const nextLocation = await getLocation();
    if (nextLocation) {
      setEntryLocation(nextLocation);
      setShowLocationEditor(false);
    }
  };

  const handleSave = async (shouldPublish: boolean) => {
    if (!entryLocation) return;

    setIsSaving(true);
    const now = new Date().toISOString();
    const timestamp = toIsoTimestamp(entryTimestamp);
    const entry: JournalEntry = {
      id: editEntry?.id || crypto.randomUUID(),
      timestamp,
      location: entryLocation,
      title: title.trim() || `Entry from ${entryLocation.city || entryLocation.country || 'Unknown'}`,
      content: content.trim(),
      mood: mood as JournalEntry['mood'],
      photos,
      tags: tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      isPublished: shouldPublish,
      createdAt: editEntry?.createdAt || now,
      updatedAt: now,
    };

    if (editEntry) {
      await updateEntry(entry);
    } else {
      await addEntry(entry);
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    }

    if (shouldPublish && settings.githubToken && settings.githubOwner && settings.githubRepo) {
      void publishToGithub().then((success) => {
        if (!success) console.warn('Auto-publish to GitHub failed');
      });
    }

    setIsSaving(false);
    onClose();
  };

  const resetRecoveredDraft = () => {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    setTitle('');
    setContent('');
    setMood('');
    setTags('');
    setEntryTimestamp(toDateTimeLocalValue(new Date().toISOString()));
    setEntryLocation(null);
    setDraftRecoveredAt(null);
    void refreshLocation();
  };

  const selectedMood = MOODS.find((option) => option.value === mood);
  const contentValue = isListening ? voiceText : content;
  const wordCount = getWordCount(contentValue);
  const readingTime = getReadingTimeMinutes(contentValue);

  return (
    <div className="new-entry-overlay">
      <div className="new-entry">
        <div className="new-entry-header">
          <div>
            <p className="eyebrow">{editEntry ? 'Refine dispatch' : 'New dispatch'}</p>
            <h2>{editEntry ? 'Edit journal entry' : 'Capture the next moment clearly'}</h2>
            <p className="new-entry-subtitle">
              {draftRecoveredAt && !editEntry
                ? `Recovered an unsent draft from ${new Date(draftRecoveredAt).toLocaleString()}.`
                : 'Drafts save locally as you type so interruptions do not cost you the story.'}
            </p>
          </div>
          <div className="new-entry-header-actions">
            {draftRecoveredAt && !editEntry ? (
              <button className="btn-text" onClick={resetRecoveredDraft}>
                Reset recovered draft
              </button>
            ) : null}
            <button className="btn-icon" onClick={onClose} aria-label="Close">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="new-entry-body">
          <section className="new-entry-main">
            <div className="composer-meta-grid">
              <div className="composer-card">
                <div className="composer-card-header">
                  <span>Location</span>
                  <button className="btn-text" onClick={() => setShowLocationEditor((current) => !current)}>
                    {showLocationEditor ? 'Hide manual edit' : 'Edit manually'}
                  </button>
                </div>

                <div className="entry-location-bar">
                  {isLocating ? (
                    <div className="location-status">
                      <Loader2 size={16} className="spin" />
                      <span>Getting your location...</span>
                    </div>
                  ) : entryLocation ? (
                    <div className="location-status location-found">
                      <MapPin size={16} />
                      <span>
                        {entryLocation.city ||
                          entryLocation.placeName ||
                          formatCoordinates(entryLocation.lat, entryLocation.lng)}
                      </span>
                      {entryLocation.country ? (
                        <span className="location-country">{entryLocation.country}</span>
                      ) : null}
                    </div>
                  ) : (
                    <p className="entry-helper-copy">
                      No location captured yet. Use GPS or fill the fields manually.
                    </p>
                  )}

                  <button className="btn btn-secondary btn-inline" onClick={refreshLocation}>
                    <Navigation size={16} />
                    <span>Use current location</span>
                  </button>
                </div>

                {showLocationEditor ? (
                  <div className="location-editor-grid">
                    <label className="field-block">
                      <span>Place label</span>
                      <input
                        type="text"
                        value={entryLocation?.placeName || ''}
                        onChange={(e) =>
                          setEntryLocation((current) => ({
                            lat: current?.lat ?? 0,
                            lng: current?.lng ?? 0,
                            ...(current ?? {}),
                            placeName: e.target.value,
                          }))
                        }
                        placeholder="Checkpoint, shelter, neighborhood..."
                      />
                    </label>
                    <label className="field-block">
                      <span>City</span>
                      <input
                        type="text"
                        value={entryLocation?.city || ''}
                        onChange={(e) =>
                          setEntryLocation((current) => ({
                            lat: current?.lat ?? 0,
                            lng: current?.lng ?? 0,
                            ...(current ?? {}),
                            city: e.target.value,
                          }))
                        }
                        placeholder="City"
                      />
                    </label>
                    <label className="field-block">
                      <span>Country</span>
                      <input
                        type="text"
                        value={entryLocation?.country || ''}
                        onChange={(e) =>
                          setEntryLocation((current) => ({
                            lat: current?.lat ?? 0,
                            lng: current?.lng ?? 0,
                            ...(current ?? {}),
                            country: e.target.value,
                          }))
                        }
                        placeholder="Country"
                      />
                    </label>
                    <label className="field-block">
                      <span>Latitude</span>
                      <input
                        type="number"
                        step="0.0001"
                        value={entryLocation?.lat ?? ''}
                        onChange={(e) =>
                          setEntryLocation((current) => ({
                            ...(current ?? {}),
                            lat: Number(e.target.value || 0),
                            lng: current?.lng ?? 0,
                          }))
                        }
                        placeholder="41.9028"
                      />
                    </label>
                    <label className="field-block">
                      <span>Longitude</span>
                      <input
                        type="number"
                        step="0.0001"
                        value={entryLocation?.lng ?? ''}
                        onChange={(e) =>
                          setEntryLocation((current) => ({
                            ...(current ?? {}),
                            lat: current?.lat ?? 0,
                            lng: Number(e.target.value || 0),
                          }))
                        }
                        placeholder="12.4964"
                      />
                    </label>
                  </div>
                ) : null}

                {geoError ? <p className="error-text">{geoError}</p> : null}
              </div>

              <div className="composer-card">
                <div className="composer-card-header">
                  <span>Time</span>
                  <Clock3 size={16} />
                </div>
                <label className="field-block">
                  <span>When did this happen?</span>
                  <input
                    type="datetime-local"
                    value={entryTimestamp}
                    onChange={(e) => setEntryTimestamp(e.target.value)}
                  />
                </label>
                <p className="entry-helper-copy">
                  Backdate entries when you need the timeline to reflect when events actually happened.
                </p>
              </div>
            </div>

            <label className="field-block">
              <span>Headline</span>
              <input
                className="entry-title-input"
                type="text"
                placeholder="Give this moment a strong title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>

            <div className="entry-content-wrapper">
              <div className="composer-toolbar">
                <div className="composer-toolbar-stats">
                  <span>{wordCount} words</span>
                  <span>{readingTime} min read</span>
                </div>
                {speechSupported ? (
                  <button
                    className={`btn btn-ghost btn-inline ${isListening ? 'is-live' : ''}`}
                    onClick={handleToggleVoice}
                  >
                    {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                    <span>{isListening ? 'Stop dictation' : 'Dictate'}</span>
                  </button>
                ) : null}
              </div>

              <textarea
                className="entry-content-input"
                placeholder={
                  isListening
                    ? 'Listening... speak naturally, then stop when you are done.'
                    : 'What happened? What did you see, feel, fear, or learn?'
                }
                value={contentValue}
                onChange={(e) => {
                  const nextValue = e.target.value;
                  if (isListening) {
                    setVoiceText(nextValue);
                  } else {
                    setContent(nextValue);
                  }
                }}
                rows={14}
              />

              {isListening ? (
                <div className="voice-indicator">
                  <div className="voice-wave"></div>
                  <span>Live dictation is active</span>
                </div>
              ) : null}

              {speechError ? <p className="error-text">{speechError}</p> : null}
            </div>
          </section>

          <aside className="new-entry-side">
            <section className="composer-card">
              <div className="composer-card-header">
                <span>Emotional weather</span>
                <Sparkles size={16} />
              </div>
              <button className="mood-selector-btn" onClick={() => setShowMoodPicker((current) => !current)}>
                {selectedMood ? (
                  <>
                    <span>{selectedMood.emoji}</span>
                    <span>{selectedMood.label}</span>
                  </>
                ) : (
                  <span>How are you feeling?</span>
                )}
                <ChevronDown size={16} />
              </button>
              {showMoodPicker ? (
                <div className="mood-grid">
                  {MOODS.map((option) => (
                    <button
                      key={option.value}
                      className={`mood-option ${mood === option.value ? 'selected' : ''}`}
                      onClick={() => {
                        setMood(option.value);
                        setShowMoodPicker(false);
                      }}
                    >
                      <span className="mood-emoji">{option.emoji}</span>
                      <span className="mood-label">{option.label}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </section>

            <section className="composer-card">
              <div className="composer-card-header">
                <span>Photos</span>
                <Camera size={16} />
              </div>
              <div className="photos-grid">
                {photos.map((photo) => (
                  <div key={photo.id} className="photo-thumb">
                    <img src={photo.dataUrl} alt={photo.caption || 'Photo'} />
                    <button className="photo-remove" onClick={() => removePhoto(photo.id)}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <label className="photo-add">
                  <Camera size={22} />
                  <span>Add Photo</span>
                  <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} hidden />
                </label>
              </div>
            </section>

            <section className="composer-card">
              <div className="composer-card-header">
                <span>Tags</span>
                <Sparkles size={16} />
              </div>
              <label className="field-block">
                <span>Comma-separated tags</span>
                <input
                  className="entry-tags-input"
                  type="text"
                  placeholder="checkpoint, crossing, aid, night"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                />
              </label>
            </section>

            <section className="composer-card composer-summary-card">
              <div className="composer-card-header">
                <span>Ready to save</span>
                <Save size={16} />
              </div>
              <div className="composer-summary-list">
                <div>
                  <strong>{wordCount}</strong>
                  <span>words</span>
                </div>
                <div>
                  <strong>{photos.length}</strong>
                  <span>photos</span>
                </div>
                <div>
                  <strong>{mood ? '1' : '0'}</strong>
                  <span>mood set</span>
                </div>
              </div>
              <p className="entry-helper-copy">
                Save as draft to keep it private on this device. Publish to include it in the next public sync.
              </p>
            </section>
          </aside>
        </div>

        <div className="entry-actions">
          <button
            className="btn btn-secondary"
            onClick={() => handleSave(false)}
            disabled={!entryLocation || !content.trim() || isSaving}
          >
            <Save size={16} />
            <span>Save Draft</span>
          </button>
          <button
            className="btn btn-primary"
            onClick={() => handleSave(true)}
            disabled={!entryLocation || !content.trim() || isSaving}
          >
            {isSaving ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
            <span>{isSaving ? 'Saving...' : 'Publish Entry'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function loadDraftSnapshot(): EntryDraftSnapshot | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as EntryDraftSnapshot;
  } catch {
    return null;
  }
}

function toDateTimeLocalValue(timestamp: string): string {
  const date = new Date(timestamp);
  const timezoneOffset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

function toIsoTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}
