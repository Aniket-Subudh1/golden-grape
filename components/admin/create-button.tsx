'use client';

import { useAuth, useConfig, useDocumentDrawer, useTranslation } from '@payloadcms/ui';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Label } from '@/lib/admin';

/**
 * "Add …" on a list page (Payload `views.list.actions`, wired by `createInDrawer()`) and in the dashboard's quick
 * actions: the new document opens in a centred modal over the current screen, which refreshes when it is saved.
 * Shown only to users who may create. `quiet` = outlined button. Collections with `admin.custom.openAsPage` (the shop
 * and stock forms, laid out like the settings pages) open the full "create" page instead.
 */
export default function CreateButton({ collectionSlug, label, quiet }: { collectionSlug: string; label: Label | string; quiet?: boolean }) {
  const router = useRouter();
  const { permissions } = useAuth();
  const { i18n } = useTranslation();
  const { getEntityConfig } = useConfig();
  const [Drawer, , { openDrawer, closeDrawer }] = useDocumentDrawer({ collectionSlug });
  if (!permissions?.collections?.[collectionSlug]?.create) return null;
  const name = typeof label === 'string' ? label : (label[i18n.language as keyof Label] ?? label.fr);
  const className = quiet ? 'gg-btn' : 'gg-btn gg-btn--primary gg-create';
  if (getEntityConfig({ collectionSlug })?.admin?.custom?.openAsPage) {
    return (
      <Link href={`/admin/collections/${collectionSlug}/create`} className={className} title={name}>
        <Plus />
        <span>{name}</span>
      </Link>
    );
  }
  return (
    <>
      <button type="button" className={className} title={name} onClick={openDrawer}>
        <Plus />
        <span>{name}</span>
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
