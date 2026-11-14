'use client';

import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';

// A click anywhere on a list row opens that document's page, like a click on its title; a checkbox or another control
// in the row keeps its own click. Cmd/Ctrl/middle-click are left to the browser (new tab). Mounted once for the whole
// admin (Payload `admin.components.providers`).

const DOC_PATH = /^\/admin\/collections\/([^/]+)\/([^/]+)\/?$/;

export default function RowLinks({ children }: { children?: ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const el = e.target instanceof Element ? e.target : null;
      // Links navigate on their own; controls and a row's dialog (GG-23) keep their click; only list rows are concerned.
      if (!el || el.closest('a[href], button, input, textarea, select, label, dialog, [role="menuitem"]')) return;
      const cell = el.closest('td');
      if (!cell || cell.querySelector('input[type="checkbox"]')) return;
      const link = [...(el.closest('tbody tr')?.querySelectorAll('a[href]') ?? [])].find(
        (a): a is HTMLAnchorElement => a instanceof HTMLAnchorElement && a.origin === window.location.origin && DOC_PATH.test(a.pathname),
      );
      if (!link) return;
      e.preventDefault();
      router.push(link.pathname);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [router]);

  return <>{children}</>;
}
