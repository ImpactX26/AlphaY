import { useSyncExternalStore } from 'react';
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import clsx from 'clsx';

type Tone = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  tone: Tone;
  text: string;
}

let items: ToastItem[] = [];
let seq = 1;
const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};

function push(tone: Tone, text: string, ms = 4200) {
  const id = seq++;
  items = [...items, { id, tone, text }].slice(-4);
  emit();
  window.setTimeout(() => dismiss(id), ms);
}
function dismiss(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

export const toast = {
  success: (text: string) => push('success', text),
  error: (text: string) => push('error', text, 6500),
  info: (text: string) => push('info', text),
};

export function errorText(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Something went wrong. Please try again.';
}

export function Toaster() {
  const list = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => items,
  );
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-3"
      aria-live="polite"
      role="status"
    >
      {list.map((t) => (
        <div
          key={t.id}
          className={clsx(
            'anim-pop-in pointer-events-auto flex w-full max-w-md items-start gap-2.5 rounded-lg border bg-surface px-3.5 py-3 text-sm shadow-float',
            t.tone === 'error' ? 'border-bad/40' : t.tone === 'success' ? 'border-ok/40' : 'border-line',
          )}
        >
          {t.tone === 'success' ? (
            <CheckCircle2 className="mt-0.5 size-4 flex-none text-ok" aria-hidden />
          ) : t.tone === 'error' ? (
            <TriangleAlert className="mt-0.5 size-4 flex-none text-bad" aria-hidden />
          ) : (
            <Info className="mt-0.5 size-4 flex-none text-agent" aria-hidden />
          )}
          <p className="min-w-0 flex-1 leading-snug">{t.text}</p>
          <button className="-m-1 rounded p-1 text-muted hover:text-ink" onClick={() => dismiss(t.id)} aria-label="Dismiss">
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
