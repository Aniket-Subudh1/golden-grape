'use client';

import { useAuth, useDocumentDrawer, useTranslation } from '@payloadcms/ui';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Label } from '@/lib/admin';

/**
 * "Add …" on a list page (Payload `views.list.actions`, wired by `createInDrawer()`) and in the dashboard's quick
 * actions: the new document opens in a centred modal over the current screen, which refreshes when it is saved.
 * Shown only to users who may create. `quiet` = outlined button.
 */
export default function CreateButton({ collectionSlug, label, quiet }: { collectionSlug: string; label: Label | string; quiet?: boolean }) {
  const router = useRouter();
  const { permissions } = useAuth();
  const { i18n } = useTranslation();
  const [Drawer, , { openDrawer, closeDrawer }] = useDocumentDrawer({ collectionSlug });
  if (!permissions?.collections?.[collectionSlug]?.create) return null;
  return (
    <>
      <button type="button" className={quiet ? 'gg-btn' : 'gg-btn gg-btn--primary gg-create'} onClick={openDrawer}>
        <Plus />
        {typeof label === 'string' ? label : (label[i18n.language as keyof Label] ?? label.fr)}
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
