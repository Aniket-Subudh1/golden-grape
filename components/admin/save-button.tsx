'use client';

import { SaveButton as PayloadSaveButton } from '@payloadcms/ui';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// On an account or team-member form, Cancel sits under the password fields and Save sits in the bar above them.
// Move Save into that same row so the two actions are beside each other. Every other screen keeps Save where it is.
export default function SaveButton({ label }: { label?: string }) {
  const [row, setRow] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const find = () => document.getElementById('cancel-change-password')?.closest<HTMLElement>('.auth-fields__controls') ?? null;
    const update = () => {
      const next = find();
      setRow((current) => (current === next ? current : next));
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const button = <PayloadSaveButton label={label} />;
  return row ? createPortal(button, row) : button;
}
