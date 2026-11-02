import Link from 'next/link';

export type NavItem = { label: string; href?: string };

/** A link, or plain text when the target page does not exist yet (no placeholder links, V-DES). */
export function NavLink({ item, className, onClick }: { item: NavItem; className?: string; onClick?: () => void }) {
  if (!item.href) return <span className={className}>{item.label}</span>;
  return (
    <Link href={item.href} className={className} onClick={onClick}>
      {item.label}
    </Link>
  );
}
