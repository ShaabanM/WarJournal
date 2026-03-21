import { useEffect, useState } from 'react';
import { useJournalStore } from './store/journalStore';
import { migrateFromDexie } from './utils/migrateFromDexie';
import ReaderView from './components/ReaderView';
import AuthorView from './components/AuthorView';
import MapView from './components/MapView';
import ToastContainer from './components/Toast';
import './App.css';

function hashToMode(hash: string): 'reader' | 'author' | 'map' {
  if (hash === '#author') return 'author';
  if (hash === '#map') return 'map';
  return 'reader';
}

function modeToHash(mode: string): string {
  if (mode === 'author') return '#author';
  if (mode === 'map') return '#map';
  return '';
}

export default function App() {
  const { viewMode, loadSettings } = useJournalStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    migrateFromDexie().then(() => {
      loadSettings();
      setReady(true);
    });
  }, [loadSettings]);

  // Check URL hash on mount
  useEffect(() => {
    const mode = hashToMode(window.location.hash);
    if (mode !== 'reader') {
      useJournalStore.getState().setViewMode(mode);
    }
  }, []);

  // Update hash when view mode changes
  useEffect(() => {
    window.location.hash = modeToHash(viewMode);
  }, [viewMode]);

  if (!ready) {
    return <div className="app" />;
  }

  return (
    <div className="app">
      {viewMode === 'author' && <AuthorView />}
      {viewMode === 'reader' && <ReaderView />}
      {viewMode === 'map' && <MapView />}
      <ToastContainer />
    </div>
  );
}
