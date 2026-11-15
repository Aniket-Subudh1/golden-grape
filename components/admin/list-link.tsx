import Link from 'next/link';
import type { ComponentProps } from 'react';

// A link into an admin list (tabs, "Effacer le filtre", the sidebar, an empty list's links). A list with no condition
// ("Toutes": `where=` from orderTabQuery / statusTabQuery) opens with a full load: on a client-side navigation
// Payload's list keeps the previous URL's filter in its state, writes it back to the address and applies it again on
// the next page or sort, while the rows shown are all of them (QA 15 Nov). Every other list link stays client-side.

/** The list URLs that must load in full. */
export const fullLoad = (href: string) => /[?&]where=(&|$)/.test(href);

export default function ListLink({ href, ...props }: Omit<ComponentProps<'a'>, 'href' | 'ref'> & { href: string }) {
  return fullLoad(href) ? <a href={href} {...props} /> : <Link href={href} {...props} />;
}
