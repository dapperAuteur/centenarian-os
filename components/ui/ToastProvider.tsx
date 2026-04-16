'use client';

// components/ui/ToastProvider.tsx
// Lightweight toast notification system. Custom instead of pulling a
// dependency because our needs are small: show a transient message
// (success / error / info), auto-dismiss after a few seconds, allow
// multiple to stack. No animation library, no portals package — just
// a React context, a fixed-position div, and a timeout per toast.
//
// Usage from any client component:
//   const toast = useToast();
//   toast.error('Could not save the lesson');
//   toast.success('Changes saved');
//
// The provider is mounted once in app/layout.tsx; all child components
// can consume via the hook.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
  /** ms before auto-dismiss. 0 = sticky (user must dismiss). */
  duration: number;
}

interface ToastContextValue {
  success: (message: string, durationMs?: number) => void;
  error: (message: string, durationMs?: number) => void;
  info: (message: string, durationMs?: number) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 5000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timeout = timeoutsRef.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutsRef.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string, durationMs = DEFAULT_DURATION) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, kind, message, duration: durationMs }]);
      if (durationMs > 0) {
        const timeout = setTimeout(() => dismiss(id), durationMs);
        timeoutsRef.current.set(id, timeout);
      }
    },
    [dismiss],
  );

  // Clear all timeouts on unmount so we don't hold references after the app
  // is gone (mostly for tests and HMR).
  useEffect(() => {
    const timeouts = timeoutsRef.current;
    return () => {
      timeouts.forEach(clearTimeout);
      timeouts.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      success: (message, ms) => push('success', message, ms),
      error: (message, ms) => push('error', message, ms ?? 0), // errors stick until dismissed
      info: (message, ms) => push('info', message, ms),
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Live region so screen readers announce toasts as they arrive */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-sm"
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

interface ToastCardProps {
  toast: Toast;
  onDismiss: () => void;
}

function ToastCard({ toast, onDismiss }: ToastCardProps) {
  const palette = {
    success: 'bg-green-900/90 border-green-700 text-green-100',
    error: 'bg-red-900/90 border-red-700 text-red-100',
    info: 'bg-gray-900/95 border-gray-700 text-gray-100',
  }[toast.kind];

  const Icon = {
    success: CheckCircle2,
    error: AlertTriangle,
    info: Info,
  }[toast.kind];

  const iconColor = {
    success: 'text-green-400',
    error: 'text-red-400',
    info: 'text-sky-400',
  }[toast.kind];

  return (
    <div
      role={toast.kind === 'error' ? 'alert' : 'status'}
      className={`pointer-events-auto flex items-start gap-3 border rounded-xl shadow-2xl px-4 py-3 backdrop-blur-sm ${palette}`}
    >
      <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${iconColor}`} aria-hidden="true" />
      <p className="flex-1 text-sm leading-snug whitespace-pre-wrap">{toast.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="min-h-11 min-w-11 -m-2 flex items-center justify-center text-current/70 hover:text-current transition"
        aria-label="Dismiss notification"
        title="Dismiss"
      >
        <X className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used inside a <ToastProvider>. Wrap your root layout.');
  }
  return ctx;
}
