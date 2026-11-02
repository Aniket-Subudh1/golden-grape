import Image from 'next/image';

/** The grape mark (Payload `admin.components.graphics.Icon`), used in the admin header. */
export default function AdminIcon() {
  return <Image src="/brand/mark.png" alt="Golden Grape" width={223} height={240} className="gg-admin-icon" />;
}
