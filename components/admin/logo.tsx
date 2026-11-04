import type { I18nClient } from '@payloadcms/translations';
import Image from 'next/image';
import { adminText } from './text';

/** Brand lockup on the login screen (Payload `admin.components.graphics.Logo`): top-left on wide screens. */
export default function AdminLogo({ i18n }: { i18n?: I18nClient }) {
  return (
    <span className="gg-lockup">
      <Image src="/brand/mark.png" alt="" width={223} height={240} loading="eager" className="gg-lockup__logo" />
      <span className="gg-lockup__text">
        <span className="gg-lockup__name">
          Golden <b>Grape</b>
        </span>
        <span className="gg-lockup__sub">{adminText(i18n?.language ?? 'fr').brandSub}</span>
      </span>
    </span>
  );
}
