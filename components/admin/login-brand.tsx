import { CalendarDays, Languages } from 'lucide-react';
import Image from 'next/image';

/**
 * Login screen (Payload `beforeLogin`), in the CUTM LMS login layout: the heading above the form, and on wide screens a
 * rounded photo panel on the right with two notes about what the back office does.
 */
export default function LoginBrand() {
  return (
    <>
      <div className="gg-login-head">
        <Image src="/brand/mark.png" alt="" width={223} height={240} className="gg-login-head__mark" />
        <h1>Sign in to the back office</h1>
        <p>Use the e-mail address of your Golden Grape account.</p>
      </div>

      <aside className="gg-login-photo" aria-hidden="true">
        <Image src="/brand/home-store/Home_9.jpg" alt="" fill priority sizes="50vw" className="gg-login-photo__img" />
        <div className="gg-login-note gg-login-note--top">
          <span className="gg-login-note__icon">
            <Languages />
          </span>
          <span>
            <b>Every page, four languages</b>
            <span>French, English, German and Portuguese, edited side by side.</span>
          </span>
        </div>
        <div className="gg-login-note gg-login-note--bottom">
          <span className="gg-login-note__icon">
            <CalendarDays />
          </span>
          <span>
            <b>Events, catering and Happy Hour</b>
            <span>What you change here is on the website straight away.</span>
          </span>
        </div>
      </aside>

      <p className="gg-login-foot">Golden Grape Luxembourg · 25 Zac Klengbousbierg, Bissen</p>
    </>
  );
}
