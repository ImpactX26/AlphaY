import clsx from 'clsx';
import { CircleAlert, CircleCheck, Info } from 'lucide-react';
import { useSyncExternalStore } from 'react';

type Tone = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  text: string;
  tone: Tone;
}

let items: ToastItem[] = [];
let next = 1;
const listeners = new Set<() => void>();
const notify = () => {
  for (const l of listeners) l();
};

/** Confirms what an action did, in the same words as the button ("Approved and sent"). */
export function toast(text: string, tone: Tone = 'success'): void {
  const id = next++;
  items = [...items, { id, text, tone }].slice(-3);
  notify();
  setTimeout(() => {
    items = items.filter((t) => t.id !== id);
    notify();
  }, 4200);
}

export function Toaster() {
  const list = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => items,
  );
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6" aria-live="polite" role="status">
      {list.map((t) => {
        const Icon = t.tone === 'success' ? CircleCheck : t.tone === 'error' ? CircleAlert : Info;
        return (
          <div
            key={t.id}
            className={clsx(
              'pop-in pointer-events-auto flex max-w-md items-center gap-2.5 rounded-lg px-4 py-2.5 text-[14px] font-medium shadow-[var(--overlay-shadow)]',
              'bg-ink text-bg',
            )}
          >
            <Icon size={17} aria-hidden className={clsx(t.tone === 'error' && 'text-[#ff9b91]', t.tone === 'success' && 'text-[#7fe0ad]')} />
            {t.text}
          </div>
        );
      })}
    </div>
  );
}
