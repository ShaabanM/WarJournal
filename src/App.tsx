import { lazy, Suspense, useEffect, useState } from 'react';
import { useJournalStore } from './store/journalStore';
import { migrateFromDexie } from './utils/migrateFromDexie';
import ReaderView from './components/ReaderView';
import AuthorView from './components/AuthorView';
import ToastContainer from './components/Toast';
import './App.css';

const ArtReaderView = lazy(() => import('./components/art/ArtReaderView'));

type Route = 'reader' | 'author' | 'art';

function getRouteFromHash(): Route {
  const hash = window.location.hash;
  if (hash === '#art') return 'art';
  if (hash === '#author') return 'author';
  return 'reader';
}

export default function App() {
  const { loadSettings } = useJournalStore();
  const [ready, setReady] = useState(false);
  const [route, setRoute] = useState<Route>(getRouteFromHash);

  useEffect(() => {
    migrateFromDexie().then(() => {
      loadSettings();
      setReady(true);
    });
  }, [loadSettings]);

  // Hash-based routing with live toggle support
  useEffect(() => {
    const handleHash = () => {
      const newRoute = getRouteFromHash();
      setRoute(newRoute);
      if (newRoute === 'author') {
        useJournalStore.getState().setViewMode('author');
      } else if (newRoute === 'reader') {
        useJournalStore.getState().setViewMode('reader');
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  if (!ready) {
    return <div className="app" />;
  }

  return (
    <div className="app">
      {route === 'art' ? (
        <Suspense fallback={<div className="app" />}>
          <ArtReaderView />
        </Suspense>
      ) : route === 'author' ? (
        <AuthorView />
      ) : (
        <ReaderView />
      )}
      <ToastContainer />
    </div>
  );
}
