import { useState } from 'react';
import { ArrowLeft, ShieldCheck, ShieldEllipsis } from 'lucide-react';

interface AuthorGateProps {
  onCancel: () => void;
  onUnlock: (pin: string) => boolean;
}

export default function AuthorGate({ onCancel, onUnlock }: AuthorGateProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const unlocked = onUnlock(pin);
    if (unlocked) {
      setError('');
      return;
    }

    setError('That PIN did not unlock the author desk.');
  };

  return (
    <div className="author-gate">
      <div className="author-gate-panel">
        <div className="author-gate-badge">
          <ShieldCheck size={18} />
          <span>Private Workspace</span>
        </div>

        <h1>Author mode is locked down</h1>
        <p>
          Your field desk is protected so the public map stays public, while drafts,
          settings, and unpublished material stay private.
        </p>

        <form className="author-gate-form" onSubmit={handleSubmit}>
          <label className="author-gate-field">
            <span>Enter your author PIN</span>
            <div className="author-gate-input-wrap">
              <ShieldEllipsis size={18} />
              <input
                autoFocus
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="PIN"
                maxLength={6}
              />
            </div>
          </label>

          {error ? <p className="author-gate-error">{error}</p> : null}

          <div className="author-gate-actions">
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              <ArrowLeft size={16} />
              <span>Back To Reader</span>
            </button>
            <button type="submit" className="btn btn-primary" disabled={!pin.trim()}>
              <ShieldCheck size={16} />
              <span>Unlock Desk</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
