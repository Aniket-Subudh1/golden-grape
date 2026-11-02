import Link from 'next/link';

export type NavItem = { label: string; href?: string };

type Props = { item: NavItem; className?: string; onClick?: () => void; 'aria-current'?: 'page' };

/** A link, or plain text when the target page does not exist yet. */
export function NavLink({ item, className, onClick, 'aria-current': current }: Props) {
  if (!item.href) return <span className={className}>{item.label}</span>;
  return (
    <Link href={item.href} className={className} onClick={onClick} aria-current={current}>
      {item.label}
    </Link>
  );
}
