'use client';

import { X } from 'lucide-react';
import { type ReactNode, useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Accessible name of the panel. */
  label: string;
  closeLabel: string;
  children: ReactNode;
  className?: string;
};

/**
 * Panel sliding in from the right over a dimmed page (cart, shop filters on phones). A native <dialog>: the browser
 * traps focus, closes on Escape and gives focus back on close; a click on the backdrop closes it too.
 */
export function Sheet({ open, onOpenChange, label, closeLabel, children, className }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      className="gg-sheet fixed inset-0 h-dvh w-screen"
      onClose={() => onOpenChange(false)}
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div className={cn('gg-sheet__panel absolute inset-y-0 right-0 flex w-full flex-col overflow-hidden bg-bone text-ink shadow-2xl sm:max-w-md', className)}>
        <button type="button" onClick={() => onOpenChange(false)} aria-label={closeLabel} className="absolute top-5 right-5 z-10 grid h-9 w-9 place-items-center rounded-full transition hover:bg-ink hover:text-bone">
          <X className="h-4 w-4" />
        </button>
        {children}
      </div>
    </dialog>
  );
}
