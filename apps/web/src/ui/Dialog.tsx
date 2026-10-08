import clsx from 'clsx';
import { X } from 'lucide-react';
import { type ReactNode, useEffect, useId, useRef } from 'react';

/** Native <dialog>: focus trap, Esc and inert background for free. */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  variant = 'center',
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  variant?: 'center' | 'sheet';
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={clsx(
        'm-0 max-h-none max-w-none border-0 bg-transparent p-0 backdrop:bg-black/45',
        // A closed <dialog> must stay display:none, so never set a display class unless it is open.
        open ? 'fixed inset-0 h-full w-full' : 'hidden',
        open && variant === 'center' && 'grid place-items-center px-4 py-6',
      )}
    >
      {open ? (
        <div
          className={clsx(
            'flex flex-col overflow-hidden border border-line bg-surface shadow-[var(--overlay-shadow)]',
            variant === 'center' && 'pop-in max-h-[min(88dvh,820px)] w-full max-w-lg rounded-xl',
            variant === 'sheet' && 'absolute inset-x-0 bottom-0 max-h-[90dvh] rounded-t-2xl [animation:sheet-up_.28s_cubic-bezier(.2,.7,.2,1)]',
            className,
          )}
        >
          <div className="flex items-start gap-3 border-b border-line px-5 py-4">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="display text-[19px] font-bold leading-tight">
                {title}
              </h2>
              {description ? <p className="mt-1 text-[13.5px] text-muted">{description}</p> : null}
            </div>
            <button type="button" className="icon-btn -mr-2 -mt-1" onClick={onClose} aria-label="Close">
              <X size={19} aria-hidden />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          {footer ? <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</div> : null}
        </div>
      ) : null}
    </dialog>
  );
}
