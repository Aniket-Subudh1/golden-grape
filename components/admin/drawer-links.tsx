'use client';

import { useConfig, useDocumentDrawer } from '@payloadcms/ui';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';

// Every link to a document (`/admin/collections/{slug}/{id}`: list rows, dashboard rows, relationship cells) opens
// the document in a drawer over the current screen instead of a separate page. A click anywhere on the row does
// the same, except on a checkbox or another control. Cmd/Ctrl/middle-click still open the page. Mounted once for
// the whole admin (Payload `admin.components.providers`). "Create" uses create-button.tsx. Collections with
// `admin.custom.openAsPage` (shop and stock) open their full page instead, from anywhere on the row.

const DOC_PATH = /^\/admin\/collections\/([^/]+)\/([^/]+)\/?$/;

type Target = { collectionSlug: string; id: string; key: number };

function EditDrawer({ collectionSlug, id }: Omit<Target, 'key'>) {
  const router = useRouter();
  const [Drawer, , { openDrawer, closeDrawer }] = useDocumentDrawer({ collectionSlug, id });
  useEffect(() => openDrawer(), [openDrawer]);
  return (
    <Drawer
      onSave={() => {
        closeDrawer();
        router.refresh();
      }}
      onDelete={() => {
        closeDrawer();
        router.refresh();
      }}
    />
  );
}

export default function DrawerLinks({ children }: { children?: ReactNode }) {
  const [target, setTarget] = useState<Target | null>(null);
  const router = useRouter();
  const { getEntityConfig } = useConfig();

  useEffect(() => {
    // Capture phase on the document runs before React's listeners; stopping it there keeps Payload's <Link> (which
    // ignores defaultPrevented) from navigating.
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const el = e.target instanceof Element ? e.target : null;
      if (!el) return;
      // A control in the row (checkbox, menu, another button) keeps its own click.
      if (el.closest('button, input, textarea, select, label, [role="menuitem"]')) return;
      const clicked = el.closest('a[href]');
      const cell = el.closest('td');
      // The checkbox column selects the row; the rest of the row opens the document.
      if (!(clicked instanceof HTMLAnchorElement) && cell?.querySelector('input[type="checkbox"]')) return;
      const row = el.closest('tbody tr');
      const link =
        clicked instanceof HTMLAnchorElement
          ? clicked
          : [...(row?.querySelectorAll('a[href]') ?? [])].find(
              (candidate): candidate is HTMLAnchorElement =>
                candidate instanceof HTMLAnchorElement && DOC_PATH.test(candidate.pathname),
            );
      if (!(link instanceof HTMLAnchorElement) || link.target === '_blank' || link.origin !== window.location.origin)
        return;
      const m = DOC_PATH.exec(link.pathname);
      if (!m || m[2] === 'create' || m[2] === 'trash') return;
      if (getEntityConfig({ collectionSlug: m[1] })?.admin?.custom?.openAsPage) {
        // A click on the link itself navigates on its own; elsewhere on the row, go to the same page.
        if (clicked instanceof HTMLAnchorElement) return;
        e.preventDefault();
        router.push(link.pathname);
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      setTarget({ collectionSlug: m[1], id: decodeURIComponent(m[2]), key: Date.now() });
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [getEntityConfig, router]);

  return (
    <>
      {children}
      {target && <EditDrawer key={target.key} collectionSlug={target.collectionSlug} id={target.id} />}
    </>
  );
}
