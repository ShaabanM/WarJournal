import { lazy, Suspense, useEffect, useState } from 'react';
import { useJournalStore } from './store/journalStore';
import { migrateFromDexie } from './utils/migrateFromDexie';
import ReaderView from './components/ReaderView';
import AuthorView from './components/AuthorView';
import ToastContainer from './components/Toast';
import './App.css';

const TomeReader = lazy(() => import('./components/art/TomeReader'));

type Route = 'reader' | 'author' | 'art';

function getRoute(): Route {
  const h = window.location.hash;
  if (h === '#art') return 'art';
  if (h === '#author') return 'author';
  return 'reader';
}

export default function App() {
  const { loadSettings } = useJournalStore();
  const [ready, setReady] = useState(false);
  const [route, setRoute] = useState<Route>(getRoute);

  useEffect(() => {
    migrateFromDexie().then(() => {
      loadSettings();
      setReady(true);
    });
  }, [loadSettings]);

  // Hash-based routing with live toggle
  useEffect(() => {
    const onHash = () => {
      const r = getRoute();
      setRoute(r);
      if (r === 'author') useJournalStore.getState().setViewMode('author');
      else if (r === 'reader') useJournalStore.getState().setViewMode('reader');
    };
    onHash();
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (!ready) return <div className="app" />;

  return (
    <div className="app">
      {route === 'art' ? (
        <Suspense fallback={<div className="app" />}>
          <TomeReader />
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
