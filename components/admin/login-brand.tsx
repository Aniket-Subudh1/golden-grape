import Image from 'next/image';

/** Login screen (Payload `beforeLogin`): the left brand pane, shown from 1024 px wide like PgMaster's owner login, and
 * the heading above the form. */
export default function LoginBrand() {
  return (
    <>
      <aside className="gg-login-pane" aria-hidden="true">
        <Image src="/brand/home-store/Home_9.jpg" alt="" fill priority sizes="50vw" className="gg-login-pane__photo" />
        <div className="gg-login-pane__shade" />
        <div className="gg-login-pane__content">
          <Image src="/brand/logo-light.png" alt="" width={1085} height={859} className="gg-login-pane__logo" />
          <div>
            <p className="gg-login-pane__title">
              L&apos;âme du Portugal, <em>servie avec passion.</em>
            </p>
            <p className="gg-login-pane__text">Back office · Golden Grape Luxembourg</p>
          </div>
          <p className="gg-login-pane__foot">25 Zac Klengbousbierg · L-7795 Bissen</p>
        </div>
      </aside>
      <div className="gg-login-head">
        <h1>Welcome back</h1>
        <p>Sign in to manage the Golden Grape website.</p>
      </div>
    </>
  );
}
