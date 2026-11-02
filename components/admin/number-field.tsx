'use client';

import { FieldDescription, FieldError, FieldLabel, fieldBaseClass, useField, useTranslation } from '@payloadcms/ui';
import type { CSSProperties } from 'react';
import { useState } from 'react';
import type { DefaultCellComponentProps, NumberFieldClientProps } from 'payload';
import { parseDecimal } from '@/lib/money';

// Prices typed in € and rates in %, stored as integer cents / basis points (money rule). Staff never see "4500".
// Wired with `scaledNumber()` in lib/admin.ts.

type Suffix = '€' | '%';

const shown = (units: number, lang: string) =>
  new Intl.NumberFormat(lang, { minimumFractionDigits: units % 100 ? 2 : 0, maximumFractionDigits: 2, useGrouping: false }).format(units / 100);

const HINT = {
  fr: 'Tapez un nombre, par ex. 45,50',
  en: 'Type a number, e.g. 45.50',
  de: 'Geben Sie eine Zahl ein, z. B. 45,50',
  pt: 'Escreva um número, por ex. 45,50',
} as const;

export default function NumberField({ field, path: pathFromProps, readOnly, suffix }: NumberFieldClientProps & { suffix: Suffix }) {
  const { i18n } = useTranslation();
  const { path, value, setValue, showError, disabled } = useField<number | null>({ potentiallyStalePath: pathFromProps });
  const [draft, setDraft] = useState<string | null>(null);
  const invalid = draft !== null && draft.trim() !== '' && Number.isNaN(parseDecimal(draft));
  const style = (field.admin?.width ? { '--field-width': field.admin.width } : { flex: '1 1 auto' }) as CSSProperties;
  const id = `field-${path.replace(/\./g, '__')}`;

  return (
    <div className={[fieldBaseClass, 'number', 'gg-number', (showError || invalid) && 'error', (readOnly || disabled) && 'read-only'].filter(Boolean).join(' ')} style={style}>
      <FieldLabel htmlFor={id} label={field.label} path={path} required={field.required} />
      <div className={`${fieldBaseClass}__wrap`}>
        <FieldError path={path} showError={showError} />
        <div className="gg-number__box">
          <input
            id={id}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            disabled={readOnly || disabled}
            value={draft ?? (typeof value === 'number' ? shown(value, i18n.language) : '')}
            onChange={(e) => {
              const text = e.target.value;
              setDraft(text);
              if (text.trim() === '') setValue(null);
              else if (!Number.isNaN(parseDecimal(text))) setValue(parseDecimal(text));
            }}
            onBlur={() => !invalid && setDraft(null)}
          />
          <span className="gg-number__suffix" aria-hidden="true">
            {suffix}
          </span>
        </div>
        {invalid && <p className="gg-number__hint">{HINT[i18n.language as keyof typeof HINT] ?? HINT.fr}</p>}
        <FieldDescription description={field.admin?.description} path={path} />
      </div>
    </div>
  );
}

/** The same amount in list columns: "120 €", "17 %". */
export function NumberCell({ cellData, suffix }: DefaultCellComponentProps & { suffix: Suffix }) {
  const { i18n } = useTranslation();
  if (typeof cellData !== 'number') return null;
  return <span>{`${shown(cellData, i18n.language)} ${suffix}`}</span>;
}
