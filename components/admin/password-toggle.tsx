'use client';

import { useTranslation } from '@payloadcms/ui';
import { type ReactNode, useEffect } from 'react';
import { adminText } from './text';

// Payload's password inputs have no reveal control. This adds one beside every password field in the admin
// (login, account, team member, reset). Mounted once from `admin.components.providers`.

const EYE = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>`;
const EYE_OFF = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.9 4.2A10 10 0 0 1 12 4c6.5 0 10 8 10 8a18 18 0 0 1-3.2 4.4M6.1 6.1A18 18 0 0 0 2 12s3.5 8 10 8a10 10 0 0 0 4.2-.9"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M2 2l20 20"/></svg>`;

export default function PasswordToggle({ children }: { children?: ReactNode }) {
  const { i18n } = useTranslation();
  const text = adminText(i18n.language);

  useEffect(() => {
    const labels = { show: text.showPassword, hide: text.hidePassword };

    const apply = (input: HTMLInputElement) => {
      if (input.dataset.ggReveal === '1' && input.type !== 'text') input.type = 'text';
    };

    const enhance = (input: HTMLInputElement) => {
      apply(input);
      const wrap = input.parentElement;
      if (!wrap || wrap.querySelector(':scope > .gg-password__eye')) return;
      wrap.classList.add('gg-password');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'gg-password__eye';
      const revealed = input.dataset.ggReveal === '1';
      button.setAttribute('aria-pressed', revealed ? 'true' : 'false');
      button.setAttribute('aria-label', revealed ? labels.hide : labels.show);
      button.innerHTML = `${EYE}${EYE_OFF}`;
      button.addEventListener('click', () => {
        const reveal = input.dataset.ggReveal !== '1';
        input.dataset.ggReveal = reveal ? '1' : '';
        input.type = reveal ? 'text' : 'password';
        button.setAttribute('aria-pressed', reveal ? 'true' : 'false');
        button.setAttribute('aria-label', reveal ? labels.hide : labels.show);
      });
      // The field is re-rendered as type="password"; put the reveal back after that render.
      if (input.dataset.ggEye !== '1') {
        input.dataset.ggEye = '1';
        new MutationObserver(() => apply(input)).observe(input, { attributes: true, attributeFilter: ['type'] });
      }
      wrap.appendChild(button);
    };

    // Save lives in the bar above the form. When Cancel is on screen, put Save in that same row,
    // and put it back when Cancel goes away.
    const placeSave = () => {
      const save = document.getElementById('action-save')?.closest('.form-submit');
      const home = document.querySelector('.doc-controls__controls');
      if (!save || !home) return;
      const row = document.getElementById('cancel-change-password')?.closest('.auth-fields__controls');
      const target = row ?? home;
      if (target.contains(save)) return;
      if (row) target.appendChild(save);
      else home.prepend(save);
    };

    const scan = () => {
      document.querySelectorAll<HTMLInputElement>('input[type="password"]').forEach(enhance);
      document.querySelectorAll<HTMLInputElement>('input[data-gg-reveal="1"]').forEach(enhance);
      placeSave();
    };
    scan();
    document.querySelectorAll<HTMLButtonElement>('.gg-password__eye').forEach((button) => {
      const input = button.parentElement?.querySelector('input');
      const revealed = input?.type === 'text';
      button.setAttribute('aria-label', revealed ? labels.hide : labels.show);
    });
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [text.showPassword, text.hidePassword]);

  return children;
}
