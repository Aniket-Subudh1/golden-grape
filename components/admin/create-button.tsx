'use client';

import { useAuth, useTranslation } from '@payloadcms/ui';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import type { Label } from '@/lib/admin';

/**
 * "Add …" on a list page (Payload `views.list.actions`, wired by `addButton()`), in a list's empty state and in the
 * dashboard's quick actions: opens the full create page, laid out like the settings pages. Shown only to users who may
 * create. `quiet` = outlined button.
 */
export default function CreateButton({ collectionSlug, label, quiet }: { collectionSlug: string; label: Label | string; quiet?: boolean }) {
  const { permissions } = useAuth();
  const { i18n } = useTranslation();
  if (!permissions?.collections?.[collectionSlug]?.create) return null;
  const name = typeof label === 'string' ? label : (label[i18n.language as keyof Label] ?? label.fr);
  return (
    <Link href={`/admin/collections/${collectionSlug}/create`} className={quiet ? 'gg-btn' : 'gg-btn gg-btn--primary gg-create'} title={name}>
      <Plus />
      <span>{name}</span>
    </Link>
  );
}
