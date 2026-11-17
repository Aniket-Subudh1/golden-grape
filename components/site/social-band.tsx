import { InstagramIcon, FacebookIcon } from '@/components/site/social-icons';
import type { Dictionary } from '@/lib/i18n';

type Props = { t: Dictionary['socialProof']; instagram?: string | null; facebook?: string | null; googleHref: string };

const link = 'group flex items-center gap-4 text-ink transition hover:text-gold-deep';
const handle = (url: string) => `@${url.replace(/\/+$/, '').split('/').pop()}`;

// The prototype's links under its reviews. The reviews themselves return with real Google data (M3.3).
export function SocialBand({ t, instagram, facebook, googleHref }: Props) {
  const external = { target: '_blank', rel: 'noopener noreferrer' };
  return (
    <section className="border-t border-border bg-champagne py-14 md:py-20">
      <div className="mx-auto flex max-w-[1400px] flex-col items-start gap-8 px-5 md:flex-row md:items-center md:justify-center md:gap-16 md:px-10">
        {instagram && (
          <a href={instagram} className={link} {...external}>
            <InstagramIcon className="h-6 w-6" strokeWidth={1.25} />
            <div>
              <div className="eyebrow">Instagram</div>
              <div className="font-serif text-xl">{handle(instagram)}</div>
            </div>
          </a>
        )}
        {facebook && (
          <a href={facebook} className={link} {...external}>
            <FacebookIcon className="h-6 w-6" strokeWidth={1.25} />
            <div>
              <div className="eyebrow">Facebook</div>
              <div className="font-serif text-xl">Golden Grape Luxembourg</div>
            </div>
          </a>
        )}
        <span className="hidden h-8 w-px bg-border md:block" />
        <a href={googleHref} className={link} {...external}>
          <span className="font-serif text-2xl text-gold-deep italic">G</span>
          <div>
            <div className="eyebrow">Google</div>
            <div className="font-serif text-xl">{t.readAll}</div>
          </div>
        </a>
      </div>
    </section>
  );
}
