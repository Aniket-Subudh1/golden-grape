'use client';

import { useAuth, useDocumentDrawer } from '@payloadcms/ui';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';

/**
 * "Create" on a list page (Payload `views.list.actions`): the new document opens in a drawer over the list instead
 * of a separate page, and the page refreshes when it is saved. Shown only to users who may create. The dashboard
 * quick actions use it too (`quiet`: an outlined button).
 */
export default function CreateButton({ collectionSlug, label, quiet }: { collectionSlug: string; label: string; quiet?: boolean }) {
  const router = useRouter();
  const { permissions } = useAuth();
  const [Drawer, , { openDrawer, closeDrawer }] = useDocumentDrawer({ collectionSlug });
  if (!permissions?.collections?.[collectionSlug]?.create) return null;
  return (
    <>
      <button type="button" className={quiet ? 'gg-btn' : 'gg-btn gg-btn--primary gg-create'} onClick={openDrawer}>
        <Plus />
        {label}
      </button>
      <Drawer
        onSave={() => {
          closeDrawer();
          router.refresh();
        }}
      />
    </>
  );
}
