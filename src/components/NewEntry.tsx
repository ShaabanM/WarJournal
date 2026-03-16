import { useState, useEffect, useRef, useCallback } from 'react';
import {
  MapPin, Mic, MicOff, Camera, X, Save, Send, Loader2,
  Navigation, CalendarDays, Newspaper, Search
} from 'lucide-react';
import { useGeolocation } from '../hooks/useGeolocation';
import { useSpeechToText } from '../hooks/useSpeechToText';
import { useJournalStore } from '../store/journalStore';
import { compressImage, createPhoto } from '../utils/photos';
import { formatCoordinates, geocodePlace, type GeocodingResult } from '../utils/geo';
import { getMoodColor } from '../utils/sentiment';
import type { JournalEntry, EntryPhoto, GeoLocation } from '../types';

interface NewEntryProps {
  onClose: () => void;
  editEntry?: JournalEntry;
}

export default function NewEntry({ onClose, editEntry }: NewEntryProps) {
  const { addEntry, updateEntry, publish: publishToGithub, settings } = useJournalStore();
  const { isLocating, error: geoError, getLocation } = useGeolocation();
  const {
    text: voiceText, isListening, isSupported: speechSupported,
    startListening, stopListening, setText: setVoiceText
  } = useSpeechToText();

  const [title, setTitle] = useState(editEntry?.title || '');
  const [content, setContent] = useState(editEntry?.content || '');
  const [mood, setMood] = useState<string>(editEntry?.mood || '');
  const [photos, setPhotos] = useState<EntryPhoto[]>(editEntry?.photos || []);
  const [tags, setTags] = useState<string>(editEntry?.tags?.join(', ') || '');
  const [entryLocation, setEntryLocation] = useState<GeoLocation | null>(editEntry?.location || null);
  const [isSaving, setIsSaving] = useState(false);
  const [newsHeadline, setNewsHeadline] = useState(editEntry?.newsHeadline || '');
  const [entryDate, setEntryDate] = useState(
    editEntry?.manualDate
      ? editEntry.manualDate.slice(0, 10)
      : new Date().toISOString().slice(0, 10)
  );
  const [showLocationSearch, setShowLocationSearch] = useState(false);
  const [locationQuery, setLocationQuery] = useState('');
  const [geocodeResults, setGeocodeResults] = useState<GeocodingResult[]>([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-get location on mount
  useEffect(() => {
    if (!editEntry) {
      getLocation().then((loc) => {
        if (loc) setEntryLocation(loc);
      });
    }
  }, []);

  // Sync voice text to content
  useEffect(() => {
    if (voiceText) {
      setContent(voiceText);
    }
  }, [voiceText]);

  const handleToggleVoice = () => {
    if (isListening) {
      stopListening();
    } else {
      // Set current content as the starting point for voice
      setVoiceText(content);
      startListening();
    }
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
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  // Debounced geocode search
  const handleLocationQueryChange = useCallback((query: string) => {
    setLocationQuery(query);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setGeocodeResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearchingLocation(true);
      const results = await geocodePlace(query);
      setGeocodeResults(results);
      setIsSearchingLocation(false);
    }, 400);
  }, []);

  const selectGeocodedLocation = (result: GeocodingResult) => {
    setEntryLocation({
      lat: result.lat,
      lng: result.lng,
      city: result.city || undefined,
      country: result.country || undefined,
      placeName: result.displayName.split(',').slice(0, 3).join(',').trim() || undefined,
    });
    setShowLocationSearch(false);
    setLocationQuery('');
    setGeocodeResults([]);
  };

  const handleSave = async (shouldPublish: boolean) => {
    const loc = entryLocation;
    if (!loc) return;
    setIsSaving(true);

    const now = new Date().toISOString();
    const todayStr = new Date().toISOString().slice(0, 10);
    const isManualDate = entryDate !== todayStr;

    const entry: JournalEntry = {
      id: editEntry?.id || crypto.randomUUID(),
      timestamp: editEntry?.timestamp || now,
      location: loc,
      title: title || `Entry from ${loc.city || loc.country || 'Unknown'}`,
      content,
      mood: mood || undefined,
      photos,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      isPublished: shouldPublish,
      createdAt: editEntry?.createdAt || now,
      updatedAt: now,
      newsHeadline: newsHeadline || undefined,
      manualDate: isManualDate ? new Date(entryDate + 'T12:00:00').toISOString() : undefined,
    };

    if (editEntry) {
      await updateEntry(entry);
    } else {
      await addEntry(entry);
    }

    // Auto-push to GitHub when publishing (if credentials are configured)
    if (shouldPublish && settings.githubToken && settings.githubOwner && settings.githubRepo) {
      // Fire and forget — don't block the UI, push happens in background
      publishToGithub().then((success) => {
        if (!success) console.warn('Auto-publish to GitHub failed');
      });
    }

    setIsSaving(false);
    onClose();
  };

  const moodColor = getMoodColor(mood || undefined);

  return (
    <div className="new-entry-overlay">
      <div className="new-entry">
        <div className="new-entry-header">
          <h2>{editEntry ? 'Edit Entry' : 'New Journal Entry'}</h2>
          <button className="btn-icon" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Date picker */}
        <div className="entry-date-bar">
          <CalendarDays size={16} />
          <input
            type="date"
            className="entry-date-input"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
          />
          {entryDate !== new Date().toISOString().slice(0, 10) && (
            <span className="date-past-badge">Past entry</span>
          )}
        </div>

        {/* Location */}
        <div className="entry-location-bar">
          {isLocating ? (
            <div className="location-status">
              <Loader2 size={16} className="spin" />
              <span>Getting your location...</span>
            </div>
          ) : entryLocation ? (
            <div className="location-status location-found">
              <MapPin size={16} />
              <span>{entryLocation.city || entryLocation.placeName || formatCoordinates(entryLocation.lat, entryLocation.lng)}</span>
              {entryLocation.country && <span className="location-country">{entryLocation.country}</span>}
              <button className="btn-icon-sm" onClick={() => setEntryLocation(null)} title="Change location">
                <X size={12} />
              </button>
            </div>
          ) : (
            <div className="location-actions">
              <button className="btn-text" onClick={() => getLocation().then((l) => l && setEntryLocation(l))}>
                <Navigation size={16} />
                <span>Use GPS</span>
              </button>
              <span className="location-or">or</span>
              <button className="btn-text" onClick={() => setShowLocationSearch(!showLocationSearch)}>
                <Search size={16} />
                <span>Search location</span>
              </button>
            </div>
          )}
          {geoError && !showLocationSearch && <p className="error-text">{geoError}</p>}
          {showLocationSearch && !entryLocation && (
            <div className="location-search-wrapper">
              <div className="location-search-input-wrap">
                <Search size={14} />
                <input
                  className="location-search-input"
                  type="text"
                  placeholder="Search for a place... (e.g. Istanbul, Turkey)"
                  value={locationQuery}
                  onChange={(e) => handleLocationQueryChange(e.target.value)}
                  autoFocus
                />
                {isSearchingLocation && <Loader2 size={14} className="spin" />}
              </div>
              {geocodeResults.length > 0 && (
                <div className="location-search-results">
                  {geocodeResults.map((result, i) => (
                    <button
                      key={i}
                      className="location-search-result"
                      onClick={() => selectGeocodedLocation(result)}
                    >
                      <MapPin size={12} />
                      <span>{result.displayName}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Title */}
        <input
          className="entry-title-input"
          type="text"
          placeholder="Entry title (optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        {/* Content with voice */}
        <div className="entry-content-wrapper">
          <textarea
            className="entry-content-input"
            placeholder={isListening ? 'Listening... speak now' : 'What happened today? How are you feeling?'}
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              if (!isListening) setVoiceText(e.target.value);
            }}
            rows={8}
          />
          {speechSupported && (
            <button
              className={`btn-voice ${isListening ? 'listening' : ''}`}
              onClick={handleToggleVoice}
              aria-label={isListening ? 'Stop recording' : 'Start recording'}
            >
              {isListening ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
          )}
          {isListening && (
            <div className="voice-indicator">
              <div className="voice-wave"></div>
              <span>Recording...</span>
            </div>
          )}
        </div>

        {/* Mood */}
        <div className="entry-mood-section">
          <div className="mood-text-input-wrap">
            <div className="mood-preview" style={{ backgroundColor: moodColor }} />
            <input
              className="mood-text-input"
              type="text"
              placeholder="How are you feeling? (e.g. grateful, anxious, mixed...)"
              value={mood}
              onChange={(e) => setMood(e.target.value)}
            />
          </div>
        </div>

        {/* Photos */}
        <div className="entry-photos-section">
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
              <Camera size={24} />
              <span>Add Photo</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoUpload}
                hidden
              />
            </label>
          </div>
        </div>

        {/* News headline */}
        <div className="entry-news-section">
          <div className="news-section-label">
            <Newspaper size={14} />
            <span>The World That Day</span>
          </div>
          <textarea
            className="entry-news-input"
            placeholder="What happened in the world today? Headlines, events, context..."
            value={newsHeadline}
            onChange={(e) => setNewsHeadline(e.target.value)}
            rows={3}
          />
        </div>

        {/* Tags */}
        <input
          className="entry-tags-input"
          type="text"
          placeholder="Tags (comma separated)"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />

        {/* Actions */}
        <div className="entry-actions">
          <button
            className="btn btn-secondary"
            onClick={() => handleSave(false)}
            disabled={!entryLocation || !content || isSaving}
          >
            <Save size={16} />
            <span>Save Draft</span>
          </button>
          <button
            className="btn btn-primary"
            onClick={() => handleSave(true)}
            disabled={!entryLocation || !content || isSaving}
          >
            {isSaving ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
            <span>Publish</span>
          </button>
        </div>
      </div>
    </div>
  );
}
