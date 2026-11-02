import Image from 'next/image';

/** Brand lockup on the login screen (Payload `admin.components.graphics.Logo`): top-left on wide screens. */
export default function AdminLogo() {
  return (
    <span className="gg-lockup">
      <Image src="/brand/mark.png" alt="" width={223} height={240} priority className="gg-lockup__logo" />
      <span className="gg-lockup__text">
        <span className="gg-lockup__name">
          Golden <b>Grape</b>
        </span>
        <span className="gg-lockup__sub">Back office</span>
      </span>
    </span>
  );
}
