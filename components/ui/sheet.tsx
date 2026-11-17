'use client';

import { X } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
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
   * the bottom edge (the staff screens' camera and forms; a centred dialog from tablets up in the staff app). */
  variant?: 'side' | 'center' | 'bottom';
};

/** How long the closing animation runs (globals.css, `.gg-sheet[data-closing]`). */
const EXIT_MS = 220;

/**
 * The page behind stops scrolling while a panel is open. Hiding the scrollbar would widen the page by its width
 * (laptops with classic scrollbars) and make everything jump, so that width is kept as padding, unless the page
 * already reserves it (`scrollbar-gutter: stable`, the website).
 */
function lockScroll() {
  const root = document.documentElement;
  const gap = window.innerWidth - root.clientWidth;
  const reserved = getComputedStyle(root).scrollbarGutter.includes('stable');
  document.body.style.overflow = 'hidden';
  if (gap > 0 && !reserved) document.body.style.paddingRight = `${gap}px`;
}
function unlockScroll() {
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';
}

/**
 * Panel over a dimmed page: sliding in from the right (cart, shop filters on phones), centred (event booking) or rising
 * from the bottom (staff). A native <dialog>: the browser traps focus and gives focus back on close. Closing (the ×,
 * the backdrop, Escape, or the parent) plays the exit animation first, with the panel's content kept as it was, so a
 * form mounted only while open does not vanish before the panel does.
 */
export function Sheet({ open, onOpenChange, label, closeLabel, children, className, variant = 'side' }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  // Closes made here (the exit, a reopen) are not the user's: the `close` event they fire is ignored.
  const ours = useRef(0);
  const closeOurs = (dialog: HTMLDialogElement) => {
    ours.current += 1;
    dialog.close();
  };
  // `shown`: the dialog is on screen, the exit animation included. `kept`: the content last rendered while open,
  // shown during the exit (React's "information from previous renders" pattern).
  const [shown, setShown] = useState(open);
  const [kept, setKept] = useState<ReactNode>(open ? children : null);
  if (open && !shown) setShown(true);
  if (open && kept !== children) setKept(children);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open) {
      // Opened again during its exit: back to a real modal.
      if (dialog.hasAttribute('data-closing')) {
        dialog.removeAttribute('data-closing');
        closeOurs(dialog);
      }
      if (!dialog.open) {
        lockScroll();
        dialog.showModal();
      }
      return;
    }
    if (!dialog.open) return;
    // Leave the modal state at once: the page behind is usable again and focus goes back now, so a scan or a tap
    // right after closing is never lost. The panel stays visible, non-modal and click-through, while it animates out.
    closeOurs(dialog);
    dialog.show();
    dialog.setAttribute('data-closing', '');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(
      () => {
        closeOurs(dialog);
        dialog.removeAttribute('data-closing');
        unlockScroll();
        setShown(false);
      },
      reduce ? 0 : EXIT_MS,
    );
    return () => window.clearTimeout(timer);
  }, [open]);

  // Unmounted, or its page hidden after a navigation (Next keeps the previous page in the DOM): a modal left open
  // there would make the new page inert.
  useEffect(() => {
    const dialog = ref.current;
    return () => {
      if (dialog?.open) {
        dialog.close();
        unlockScroll();
      }
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      className={cn(
        'gg-sheet fixed inset-0 h-dvh w-screen',
        variant === 'center' && 'gg-sheet--center place-items-center p-4 open:grid',
        variant === 'bottom' && 'gg-sheet--bottom',
      )}
      // Escape: the same exit as the × (the browser would otherwise close it at once).
      onCancel={(e) => {
        e.preventDefault();
        onOpenChange(false);
      }}
      // A close the browser made by itself (Android's back twice): the parent learns it, so the panel can open again.
      onClose={() => {
        if (ours.current > 0) ours.current -= 1;
        else if (open) onOpenChange(false);
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div
        className={cn(
          'gg-sheet__panel bg-bone text-ink flex w-full flex-col overflow-hidden shadow-2xl',
          variant === 'side' && 'absolute inset-y-0 right-0 sm:max-w-md',
          variant === 'center' && 'relative max-h-[calc(100dvh-2rem)] max-w-lg overflow-y-auto rounded-2xl',
          variant === 'bottom' &&
            'absolute inset-x-0 bottom-0 mx-auto max-h-[92dvh] max-w-md overflow-y-auto overscroll-contain rounded-t-2xl pb-[env(safe-area-inset-bottom)]',
          className,
        )}
      >
        {variant === 'bottom' && <span className="gg-sheet__grip" aria-hidden="true" />}
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label={closeLabel}
          className="hover:bg-ink hover:text-bone absolute top-5 right-5 z-10 grid h-9 w-9 place-items-center rounded-full transition"
        >
          <X className="h-4 w-4" />
        </button>
        {open ? children : shown ? kept : children}
      </div>
    </dialog>
  );
}
