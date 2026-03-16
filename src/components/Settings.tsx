import { useState } from 'react';
import { X, Save, Github, User, Shield, Globe, Compass } from 'lucide-react';
import { useJournalStore } from '../store/journalStore';
import { format } from 'date-fns';

const MAP_STYLE_PRESETS = [
  {
    label: 'Dark Matter',
    value: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  },
  {
    label: 'Voyager',
    value: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  },
  {
    label: 'Positron',
    value: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  },
];

interface SettingsPanelProps {
  onClose: () => void;
}

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { settings, saveSettings } = useJournalStore();
  const [authorName, setAuthorName] = useState(settings.authorName);
  const [journalTitle, setJournalTitle] = useState(settings.journalTitle || 'War Journal');
  const [journalSubtitle, setJournalSubtitle] = useState(
    settings.journalSubtitle || 'Field notes from a world unspooling in real time.'
  );
  const [githubToken, setGithubToken] = useState(settings.githubToken || '');
  const [githubOwner, setGithubOwner] = useState(settings.githubOwner || '');
  const [githubRepo, setGithubRepo] = useState(settings.githubRepo || '');
  const [authorPin, setAuthorPin] = useState(settings.authorPin || '');
  const [mapStyle, setMapStyle] = useState(settings.mapStyle);
  const [saved, setSaved] = useState(false);
  const publicUrl =
    githubOwner && githubRepo ? `https://${githubOwner}.github.io/${githubRepo}/` : null;

  const handleSave = async () => {
    await saveSettings({
      ...settings,
      authorName,
      journalTitle,
      journalSubtitle,
      githubToken: githubToken || undefined,
      githubOwner: githubOwner || undefined,
      githubRepo: githubRepo || undefined,
      authorPin: authorPin || undefined,
      mapStyle,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="settings-overlay">
      <div className="settings-panel">
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="btn-icon" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="settings-body">
          <div className="settings-section">
            <h3><User size={16} /> Journal identity</h3>
            <label className="setting-field">
              <span>Journal Title</span>
              <input
                type="text"
                value={journalTitle}
                onChange={(e) => setJournalTitle(e.target.value)}
                placeholder="War Journal"
              />
            </label>
            <label className="setting-field">
              <span>Journal Subtitle</span>
              <textarea
                value={journalSubtitle}
                onChange={(e) => setJournalSubtitle(e.target.value)}
                placeholder="Tell readers what this journal is documenting"
                rows={3}
              />
            </label>
            <label className="setting-field">
              <span>Author Name</span>
              <input
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="Your name"
              />
            </label>
          </div>

          <div className="settings-section">
            <h3><Shield size={16} /> Privacy</h3>
            <label className="setting-field">
              <span>Author PIN (optional)</span>
              <input
                type="password"
                value={authorPin}
                onChange={(e) => setAuthorPin(e.target.value)}
                placeholder="Simple PIN to protect author view"
                maxLength={6}
              />
            </label>
            <p className="settings-description">
              When a PIN is set, author mode is locked until the correct code is entered in this browser session.
            </p>
          </div>

          <div className="settings-section">
            <h3><Compass size={16} /> Map style</h3>
            <label className="setting-field">
              <span>Map Theme</span>
              <select value={mapStyle} onChange={(e) => setMapStyle(e.target.value)}>
                {MAP_STYLE_PRESETS.map((preset) => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="settings-section">
            <h3><Github size={16} /> GitHub Publishing</h3>
            <p className="settings-description">
              Connect to GitHub to publish your journal entries. Readers will be able to
              follow your journey on the GitHub Pages site.
            </p>
            <label className="setting-field">
              <span>GitHub Username</span>
              <input
                type="text"
                value={githubOwner}
                onChange={(e) => setGithubOwner(e.target.value)}
                placeholder="e.g., ShaabanM"
              />
            </label>
            <label className="setting-field">
              <span>Repository Name</span>
              <input
                type="text"
                value={githubRepo}
                onChange={(e) => setGithubRepo(e.target.value)}
                placeholder="e.g., WarJournal"
              />
            </label>
            <label className="setting-field">
              <span>Personal Access Token</span>
              <input
                type="password"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                placeholder="ghp_..."
              />
              <span className="setting-hint">
                Needs 'repo' scope. Create at GitHub → Settings → Developer settings → Tokens
              </span>
            </label>
            {publicUrl ? (
              <div className="settings-callout">
                <div className="settings-callout-header">
                  <Globe size={15} />
                  <span>Public journal URL</span>
                </div>
                <a href={publicUrl} target="_blank" rel="noreferrer">
                  {publicUrl}
                </a>
                {settings.lastPublishedAt ? (
                  <p>Last successful publish: {format(new Date(settings.lastPublishedAt), 'PPP p')}</p>
                ) : (
                  <p>No successful publish recorded yet.</p>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <div className="settings-footer">
          {saved && <span className="save-confirmation">Settings saved!</span>}
          <button className="btn btn-primary" onClick={handleSave}>
            <Save size={16} />
            <span>Save Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
}
