'use client';

import { useDocumentDrawer } from '@payloadcms/ui';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';

// Every link to a document (`/admin/collections/{slug}/{id}`: list rows, dashboard rows, relationship cells) opens
// the document in a drawer over the current screen instead of a separate page. Cmd/Ctrl/middle-click still open the
// page. Mounted once for the whole admin (Payload `admin.components.providers`). "Create" uses create-button.tsx.

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

  useEffect(() => {
    // Capture phase on the document runs before React's listeners; stopping it there keeps Payload's <Link> (which
    // ignores defaultPrevented) from navigating.
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]');
      if (!(a instanceof HTMLAnchorElement) || a.target === '_blank' || a.origin !== window.location.origin) return;
      const m = DOC_PATH.exec(a.pathname);
      if (!m || m[2] === 'create' || m[2] === 'trash') return;
      e.preventDefault();
      e.stopPropagation();
      setTarget({ collectionSlug: m[1], id: decodeURIComponent(m[2]), key: Date.now() });
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  return (
    <>
      {children}
      {target && <EditDrawer key={target.key} collectionSlug={target.collectionSlug} id={target.id} />}
    </>
  );
}
