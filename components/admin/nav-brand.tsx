import Image from 'next/image';
import Link from 'next/link';

/** Brand header at the top of the admin sidebar (Payload `beforeNavLinks`), like PgMaster's sidebar. */
export default function NavBrand() {
  return (
    <Link href="/admin" className="gg-nav-brand">
      <Image src="/brand/mark.png" alt="" width={180} height={240} className="gg-nav-brand__mark" />
      <span>
        <span className="gg-nav-brand__name">Golden Grape</span>
        <span className="gg-nav-brand__sub">Back office</span>
      </span>
    </Link>
  );
}
