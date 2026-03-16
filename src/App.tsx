import { lazy, Suspense, useEffect, useState } from 'react';
import { useJournalStore } from './store/journalStore';
import AuthorGate from './components/AuthorGate';
import './App.css';

const ReaderView = lazy(() => import('./components/ReaderView'));
const AuthorView = lazy(() => import('./components/AuthorView'));
const AUTHOR_SESSION_KEY = 'war-journal-author-unlocked';

function getAuthorSessionState(): boolean {
  if (typeof window === 'undefined') return false;
  return window.sessionStorage.getItem(AUTHOR_SESSION_KEY) === 'true';
}

export default function App() {
  const { viewMode, loadSettings, settings, setViewMode } = useJournalStore();
  const [isSettingsReady, setIsSettingsReady] = useState(false);
  const [isAuthorUnlocked, setIsAuthorUnlocked] = useState<boolean>(() =>
    getAuthorSessionState()
  );

  useEffect(() => {
    void loadSettings().then(() => setIsSettingsReady(true));
  }, [loadSettings]);

  useEffect(() => {
    const syncFromHash = () => {
      const nextMode = window.location.hash === '#author' ? 'author' : 'reader';
      useJournalStore.getState().setViewMode(nextMode);
    };

    syncFromHash();
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, []);

  useEffect(() => {
    const nextHash = viewMode === 'author' ? '#author' : '';
    if (window.location.hash === nextHash) return;

    if (nextHash) {
      window.location.hash = nextHash;
      return;
    }

    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  }, [viewMode]);

  const handleUnlock = (pin: string): boolean => {
    if (!settings.authorPin || pin === settings.authorPin) {
      window.sessionStorage.setItem(AUTHOR_SESSION_KEY, 'true');
      setIsAuthorUnlocked(true);
      return true;
    }

    return false;
  };

  const handleLock = () => {
    window.sessionStorage.removeItem(AUTHOR_SESSION_KEY);
    setIsAuthorUnlocked(false);
    setViewMode('reader');
  };

  const handleAuthorCancel = () => {
    setViewMode('reader');
  };

  return (
    <div className="app">
      {!isSettingsReady ? (
        <div className="screen-loader">
          <div className="screen-loader-panel">
            <span className="screen-loader-kicker">Initializing theater</span>
            <h1>Loading War Journal</h1>
            <p>Preparing the latest dispatches, map layers, and private workspace.</p>
          </div>
        </div>
      ) : (
        <Suspense
          fallback={
            <div className="screen-loader">
              <div className="screen-loader-panel">
                <span className="screen-loader-kicker">Initializing theater</span>
                <h1>Loading War Journal</h1>
                <p>Preparing the latest dispatches, map layers, and private workspace.</p>
              </div>
            </div>
          }
        >
          {viewMode === 'reader' ? (
            <ReaderView />
          ) : settings.authorPin && !isAuthorUnlocked ? (
            <AuthorGate onCancel={handleAuthorCancel} onUnlock={handleUnlock} />
          ) : (
            <AuthorView onLock={handleLock} />
          )}
        </Suspense>
      )}
    </div>
  );
}
