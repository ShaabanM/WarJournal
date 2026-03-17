import { useEffect, useState } from 'react';
import { useJournalStore } from './store/journalStore';
import { migrateFromDexie } from './utils/migrateFromDexie';
import ReaderView from './components/ReaderView';
import AuthorView from './components/AuthorView';
import ToastContainer from './components/Toast';
import './App.css';

export default function App() {
  const { viewMode, loadSettings } = useJournalStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Migrate settings from old IndexedDB, then load from localStorage
    migrateFromDexie().then(() => {
      loadSettings();
      setReady(true);
    });
  }, [loadSettings]);

  // Check URL hash for author mode
  useEffect(() => {
    const hash = window.location.hash;
    if (hash === '#author') {
      useJournalStore.getState().setViewMode('author');
    }
  }, []);

  // Update hash when view mode changes
  useEffect(() => {
    window.location.hash = viewMode === 'author' ? '#author' : '';
  }, [viewMode]);

  if (!ready) {
    return <div className="app" />;
  }

  return (
    <div className="app">
      {viewMode === 'reader' ? <ReaderView /> : <AuthorView />}
      <ToastContainer />
    </div>
  );
}
