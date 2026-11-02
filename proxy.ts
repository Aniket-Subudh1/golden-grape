import { type NextRequest, NextResponse } from 'next/server';
import { DEFAULT_LOCALE, isLocale } from '@/lib/i18n';

// French is always the entry language; a language picked in the switcher (NEXT_LOCALE cookie) wins.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isLocale(pathname.split('/')[1])) return NextResponse.next();
  const cookie = request.cookies.get('NEXT_LOCALE')?.value;
  const url = request.nextUrl.clone();
  url.pathname = `/${isLocale(cookie) ? cookie : DEFAULT_LOCALE}${pathname === '/' ? '' : pathname}`;
  return NextResponse.redirect(url, 307);
}

export const config = {
  // Everything except the admin, APIs, staff app, Next internals and files with an extension.
  matcher: ['/((?!(?:admin|api|staff)(?:/|$)|_next/|.*\\.\\w+$).*)'],
};
