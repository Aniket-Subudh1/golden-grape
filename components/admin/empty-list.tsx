import { ArrowLeftRight, CalendarCheck, ClipboardCheck, MapPin, Package, ShoppingBag, Store, Tags, Ticket, TriangleAlert, UsersRound } from 'lucide-react';
import Link from 'next/link';
import type { PaginatedDocs } from 'payload';
import type { Label } from '@/lib/admin';
import CreateButton from './create-button';

// The first-use state of a list (Payload `beforeListTable`, wired with `emptyList()` in lib/admin.ts): what the list
// is for and the button to add the first one, instead of Payload's generic "No results". It shows only when nothing
// exists yet; when a search or filter matches nothing, Payload's own message stays (restyled in custom.css).

const ICONS = {
  products: Package,
  categories: Tags,
  producers: Store,
  counts: ClipboardCheck,
  movements: ArrowLeftRight,
  lowStock: TriangleAlert,
  customers: UsersRound,
  orders: ShoppingBag,
  reservations: CalendarCheck,
  bookings: Ticket,
  zones: MapPin,
};
export type EmptyIcon = keyof typeof ICONS;

type Props = {
  data?: PaginatedDocs;
  searchParams?: Record<string, unknown>;
  collectionConfig?: { slug: string };
  i18n?: { language: string };
  icon: EmptyIcon;
  title: Label;
  text: Label;
  action?: Label;
  /** Also shown when a filter is applied (the low-stock list is always opened with one). */
  evenFiltered?: boolean;
  /** Where the documents are instead: the stage tabs that have some, with their counts (QA 12 Nov, GG-04/08). */
  links?: { href: string; label: string }[];
};

export default function EmptyList({ data, searchParams = {}, collectionConfig, i18n, icon, title, text, action, evenFiltered, links = [] }: Props) {
  const filtered = Boolean(searchParams.search || searchParams.where);
  if (!data || data.totalDocs > 0 || (filtered && !evenFiltered)) return null;
  const lang = (i18n?.language ?? 'fr') as keyof Label;
  const Icon = ICONS[icon];
  return (
    <section className={`gg-empty${evenFiltered ? ' gg-empty--good' : ''}`}>
      <span className="gg-empty__icon">
        <Icon />
      </span>
      <h2>{title[lang] ?? title.fr}</h2>
      <p>{text[lang] ?? text.fr}</p>
      {links.length > 0 && (
        <p className="gg-empty__links">
          {links.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </p>
      )}
      {action && collectionConfig && <CreateButton collectionSlug={collectionConfig.slug} label={action} />}
    </section>
  );
}
