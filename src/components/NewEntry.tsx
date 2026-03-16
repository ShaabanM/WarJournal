import { useState, useEffect } from 'react';
import {
  MapPin, Mic, MicOff, Camera, X, Save, Send, Loader2,
  Navigation, ChevronDown, CalendarDays, Newspaper, Globe
} from 'lucide-react';
import { useGeolocation } from '../hooks/useGeolocation';
import { useSpeechToText } from '../hooks/useSpeechToText';
import { useJournalStore } from '../store/journalStore';
import { compressImage, createPhoto } from '../utils/photos';
import { formatCoordinates } from '../utils/geo';
import type { JournalEntry, EntryPhoto, GeoLocation } from '../types';

const MOODS = [
  { value: 'hopeful', emoji: '🌅', label: 'Hopeful' },
  { value: 'anxious', emoji: '😰', label: 'Anxious' },
  { value: 'grateful', emoji: '🙏', label: 'Grateful' },
  { value: 'reflective', emoji: '🪞', label: 'Reflective' },
  { value: 'determined', emoji: '💪', label: 'Determined' },
  { value: 'somber', emoji: '🌧️', label: 'Somber' },
  { value: 'joyful', emoji: '✨', label: 'Joyful' },
  { value: 'exhausted', emoji: '😮‍💨', label: 'Exhausted' },
] as const;

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
  const [showMoodPicker, setShowMoodPicker] = useState(false);
  const [newsHeadline, setNewsHeadline] = useState(editEntry?.newsHeadline || '');
  const [entryDate, setEntryDate] = useState(
    editEntry?.manualDate
      ? editEntry.manualDate.slice(0, 10)
      : new Date().toISOString().slice(0, 10)
  );
  const [showManualLocation, setShowManualLocation] = useState(false);
  const [manualCity, setManualCity] = useState(editEntry?.location?.city || '');
  const [manualCountry, setManualCountry] = useState(editEntry?.location?.country || '');
  const [manualLat, setManualLat] = useState(editEntry?.location?.lat?.toString() || '');
  const [manualLng, setManualLng] = useState(editEntry?.location?.lng?.toString() || '');

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

  const applyManualLocation = () => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (manualCity || manualCountry) {
      setEntryLocation({
        lat: isNaN(lat) ? 0 : lat,
        lng: isNaN(lng) ? 0 : lng,
        city: manualCity || undefined,
        country: manualCountry || undefined,
        placeName: [manualCity, manualCountry].filter(Boolean).join(', ') || undefined,
      });
    }
  };

  const handleSave = async (shouldPublish: boolean) => {
    // If manual location is showing and fields filled, apply it
    if (showManualLocation && !entryLocation && (manualCity || manualCountry)) {
      applyManualLocation();
    }

    const loc = entryLocation || (showManualLocation ? {
      lat: parseFloat(manualLat) || 0,
      lng: parseFloat(manualLng) || 0,
      city: manualCity || undefined,
      country: manualCountry || undefined,
      placeName: [manualCity, manualCountry].filter(Boolean).join(', ') || undefined,
    } : null);

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
      mood: mood as JournalEntry['mood'],
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

  const selectedMood = MOODS.find((m) => m.value === mood);

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
            </div>
          ) : (
            <div className="location-actions">
              <button className="btn-text" onClick={() => getLocation().then((l) => l && setEntryLocation(l))}>
                <Navigation size={16} />
                <span>Use GPS</span>
              </button>
              <span className="location-or">or</span>
              <button className="btn-text" onClick={() => setShowManualLocation(!showManualLocation)}>
                <Globe size={16} />
                <span>Enter Manually</span>
              </button>
            </div>
          )}
          {geoError && !showManualLocation && <p className="error-text">{geoError}</p>}
          {showManualLocation && !entryLocation && (
            <div className="manual-location-fields">
              <div className="manual-location-row">
                <input
                  className="manual-location-input"
                  type="text"
                  placeholder="City"
                  value={manualCity}
                  onChange={(e) => setManualCity(e.target.value)}
                />
                <input
                  className="manual-location-input"
                  type="text"
                  placeholder="Country"
                  value={manualCountry}
                  onChange={(e) => setManualCountry(e.target.value)}
                />
              </div>
              <div className="manual-location-row">
                <input
                  className="manual-location-input"
                  type="text"
                  placeholder="Latitude (optional)"
                  value={manualLat}
                  onChange={(e) => setManualLat(e.target.value)}
                />
                <input
                  className="manual-location-input"
                  type="text"
                  placeholder="Longitude (optional)"
                  value={manualLng}
                  onChange={(e) => setManualLng(e.target.value)}
                />
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={applyManualLocation}
                disabled={!manualCity && !manualCountry}
              >
                <MapPin size={14} />
                <span>Set Location</span>
              </button>
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
          <button
            className="mood-selector-btn"
            onClick={() => setShowMoodPicker(!showMoodPicker)}
          >
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
          {showMoodPicker && (
            <div className="mood-grid">
              {MOODS.map((m) => (
                <button
                  key={m.value}
                  className={`mood-option ${mood === m.value ? 'selected' : ''}`}
                  onClick={() => {
                    setMood(m.value);
                    setShowMoodPicker(false);
                  }}
                >
                  <span className="mood-emoji">{m.emoji}</span>
                  <span className="mood-label">{m.label}</span>
                </button>
              ))}
            </div>
          )}
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
            disabled={(!entryLocation && !manualCity && !manualCountry) || !content || isSaving}
          >
            <Save size={16} />
            <span>Save Draft</span>
          </button>
          <button
            className="btn btn-primary"
            onClick={() => handleSave(true)}
            disabled={(!entryLocation && !manualCity && !manualCountry) || !content || isSaving}
          >
            {isSaving ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
            <span>Publish</span>
          </button>
        </div>
      </div>
    </div>
  );
}
