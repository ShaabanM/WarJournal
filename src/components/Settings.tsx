import { useState } from 'react';
import { X, Save, Github, User } from 'lucide-react';
import { useJournalStore } from '../store/journalStore';

interface SettingsPanelProps {
  onClose: () => void;
}

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { settings, saveSettings } = useJournalStore();
  const [authorName, setAuthorName] = useState(settings.authorName);
  const [githubToken, setGithubToken] = useState(settings.githubToken || '');
  const [githubOwner, setGithubOwner] = useState(settings.githubOwner || '');
  const [githubRepo, setGithubRepo] = useState(settings.githubRepo || '');
  const [authorPin, setAuthorPin] = useState(settings.authorPin || '');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    saveSettings({
      ...settings,
      authorName,
      githubToken: githubToken || undefined,
      githubOwner: githubOwner || undefined,
      githubRepo: githubRepo || undefined,
      authorPin: authorPin || undefined,
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
            <h3><User size={16} /> Profile</h3>
            <label className="setting-field">
              <span>Author Name</span>
              <input
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="Your name"
              />
            </label>
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
          </div>

          <div className="settings-section">
            <h3><Github size={16} /> GitHub Storage</h3>
            <p className="settings-description">
              Connect to GitHub to store and sync your journal entries across devices.
              Your token is stored on this device only.
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
