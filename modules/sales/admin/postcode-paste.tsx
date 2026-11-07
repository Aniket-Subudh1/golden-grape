'use client';

import { useField, useTranslation } from '@payloadcms/ui';
import { useState } from 'react';
import { l, type Label } from '@/lib/admin';
import { isLuxPostalCode, splitPostalCodes } from '../zones';

// "Paste several postcodes" (GG-036), above a delivery zone's postcodes: a list copied from anywhere (commas, spaces,
// line breaks) becomes separate entries in the field below at once, without the duplicates. Saving still checks them.

const T = {
  label: l('Coller plusieurs codes postaux', 'Paste several postcodes', 'Mehrere Postleitzahlen einfügen', 'Colar vários códigos postais'),
  placeholder: l('7760, 7770, 7780 ou un par ligne', '7760, 7770, 7780 or one per line', '7760, 7770, 7780 oder einer pro Zeile', '7760, 7770, 7780 ou um por linha'),
  add: l('Ajouter à la liste', 'Add to the list', 'Zur Liste hinzufügen', 'Juntar à lista'),
  added: l('{n} ajouté(s).', '{n} added.', '{n} hinzugefügt.', '{n} juntado(s).'),
  wrong: l('Ignorés (pas 4 chiffres) : {list}', 'Skipped (not 4 digits): {list}', 'Übersprungen (keine 4 Ziffern): {list}', 'Ignorados (não têm 4 algarismos): {list}'),
};

export default function PostcodePaste({ path, field }: { path: string; field: string }) {
  const { i18n } = useTranslation();
  const say = (label: Label) => label[i18n.language as keyof Label] ?? label.fr;
  const target = path.includes('.') ? `${path.slice(0, path.lastIndexOf('.'))}.${field}` : field;
  const { value, setValue } = useField<string[]>({ path: target });
  const [text, setText] = useState('');
  const [message, setMessage] = useState('');

  function add() {
    const pasted = splitPostalCodes([text]);
    const valid = pasted.filter(isLuxPostalCode);
    const wrong = pasted.filter((c) => !isLuxPostalCode(c));
    const before = value ?? [];
    const next = splitPostalCodes([...before, ...valid]);
    setValue(next);
    setText(wrong.join(', '));
    setMessage([say(T.added).replace('{n}', String(next.length - before.length)), wrong.length ? say(T.wrong).replace('{list}', wrong.join(', ')) : ''].filter(Boolean).join(' '));
  }

  return (
    <div className="gg-paste">
      <label>
        <span>{say(T.label)}</span>
        <textarea rows={2} value={text} placeholder={say(T.placeholder)} onChange={(e) => setText(e.target.value)} />
      </label>
      <div className="gg-paste__actions">
        <button type="button" className="gg-btn" disabled={!text.trim()} onClick={add}>
          {say(T.add)}
        </button>
        {message && <span role="status">{message}</span>}
      </div>
    </div>
  );
}
