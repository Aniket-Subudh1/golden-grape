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
  /** `side`: slides in from the right (cart, filters). `center`: a centred card (event booking). `bottom`: rises from
   * the bottom edge (the staff screens' camera and forms). */
  variant?: 'side' | 'center' | 'bottom';
};

/**
 * Panel over a dimmed page: sliding in from the right (cart, shop filters on phones) or centred (event booking). A
 * native <dialog>: the browser traps focus, closes on Escape and gives focus back on close; a click on the backdrop
 * closes it too.
 */
export function Sheet({ open, onOpenChange, label, closeLabel, children, className, variant = 'side' }: Props) {
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
      className={cn('gg-sheet fixed inset-0 h-dvh w-screen', variant === 'center' && 'gg-sheet--center place-items-center p-4 open:grid', variant === 'bottom' && 'gg-sheet--bottom')}
      onClose={() => onOpenChange(false)}
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div
        className={cn(
          'gg-sheet__panel flex w-full flex-col overflow-hidden bg-bone text-ink shadow-2xl',
          variant === 'side' && 'absolute inset-y-0 right-0 sm:max-w-md',
          variant === 'center' && 'relative max-h-[calc(100dvh-2rem)] max-w-lg overflow-y-auto rounded-2xl',
          variant === 'bottom' && 'absolute inset-x-0 bottom-0 mx-auto max-h-[92dvh] max-w-md overflow-y-auto rounded-t-2xl pb-[env(safe-area-inset-bottom)]',
          className,
        )}
      >
        <button type="button" onClick={() => onOpenChange(false)} aria-label={closeLabel} className="absolute top-5 right-5 z-10 grid h-9 w-9 place-items-center rounded-full transition hover:bg-ink hover:text-bone">
          <X className="h-4 w-4" />
        </button>
        {children}
      </div>
    </dialog>
  );
}
