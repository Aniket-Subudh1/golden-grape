import { CalendarDays, Languages } from 'lucide-react';
import Image from 'next/image';
import type { I18nClient } from '@payloadcms/translations';
import LanguageMenu from './language-menu';
import { adminText } from './text';

/**
 * Login screen (Payload `beforeLogin`), in the CUTM LMS login layout: the heading above the form, the admin
 * language menu top-right, and on wide screens a rounded photo panel with two notes about the back office.
 */
export default function LoginBrand({ i18n }: { i18n: I18nClient }) {
  const t = adminText(i18n.language).login;
  return (
    <>
      <div className="gg-login-lang">
        <LanguageMenu />
      </div>

      <div className="gg-login-head">
        <Image src="/brand/mark.png" alt="" width={223} height={240} className="gg-login-head__mark" />
        <h1>{t.title}</h1>
        <p>{t.text}</p>
      </div>

      <aside className="gg-login-photo" aria-hidden="true">
        <Image src="/brand/home-store/Home_9.jpg" alt="" fill loading="eager" fetchPriority="high" sizes="50vw" className="gg-login-photo__img" />
        <div className="gg-login-note gg-login-note--top">
          <span className="gg-login-note__icon">
            <Languages />
          </span>
          <span>
            <b>{t.note1}</b>
            <span>{t.note1Text}</span>
          </span>
        </div>
        <div className="gg-login-note gg-login-note--bottom">
          <span className="gg-login-note__icon">
            <CalendarDays />
          </span>
          <span>
            <b>{t.note2}</b>
            <span>{t.note2Text}</span>
          </span>
        </div>
      </aside>

      <p className="gg-login-foot">Golden Grape Luxembourg · 25 Zac Klengbousbierg, Bissen</p>
    </>
  );
}
