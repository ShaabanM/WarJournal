import { X } from 'lucide-react';
import { useJournalStore } from '../store/journalStore';

export default function ToastContainer() {
  const toasts = useJournalStore((s) => s.toasts);
  const dismissToast = useJournalStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          <span className="toast-message">{toast.message}</span>
          <button className="toast-dismiss" onClick={() => dismissToast(toast.id)}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
