import Image from 'next/image';

/** Login card logo (Payload `admin.components.graphics.Logo`). On wide screens the brand pane shows it instead. */
export default function AdminLogo() {
  return <Image src="/brand/logo-light.png" alt="Golden Grape · Mäi Wäin" width={1085} height={859} priority className="gg-admin-logo" />;
}
