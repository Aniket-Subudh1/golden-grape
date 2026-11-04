'use client';

import { useRowLabel, useTranslation } from '@payloadcms/ui';
import { useEffect, useState } from 'react';

// A stock-count line titled by what was counted ("Douro Reserva 2019 · 7") instead of "Article 01".

const NEW = { fr: 'Nouvel article', en: 'New item', de: 'Neuer Artikel', pt: 'Novo artigo' };

export default function CountRowLabel() {
  const { data, rowNumber = 0 } = useRowLabel<{ variant?: string | { id: string; title?: string }; counted?: number }>();
  const { i18n } = useTranslation();
  const id = typeof data?.variant === 'object' ? data.variant.id : data?.variant;
  const [title, setTitle] = useState<string | null>(null);
  useEffect(() => {
    if (!id) return;
    let current = true;
    void fetch(`/api/variants/${id}?depth=0&select[title]=true`, { credentials: 'include' })
      .then((r) => (r.ok ? (r.json() as Promise<{ title?: string }>) : null))
      .then((v) => current && setTitle(v?.title ?? null));
    return () => {
      current = false;
    };
  }, [id]);
  const name = id ? title : null;
  return (
    <span className="gg-row-label">
      <span>{name ?? `${NEW[i18n.language as keyof typeof NEW] ?? NEW.fr} ${rowNumber + 1}`}</span>
      {id && typeof data?.counted === 'number' && <b>{data.counted}</b>}
    </span>
  );
}
