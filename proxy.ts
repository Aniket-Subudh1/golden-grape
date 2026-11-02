import { type NextRequest, NextResponse } from 'next/server';
import { DEFAULT_LOCALE, isLocale } from '@/lib/i18n';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Admin: French until the person picks another language (Payload's `payload-lng` cookie). Payload would otherwise
  // follow the browser's language.
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    if (request.cookies.has('payload-lng')) return NextResponse.next();
    const headers = new Headers(request.headers);
    headers.set('accept-language', 'fr');
    return NextResponse.next({ request: { headers } });
  }

  // Website: French is always the entry language; a language picked in the switcher (NEXT_LOCALE cookie) wins.
  if (isLocale(pathname.split('/')[1])) return NextResponse.next();
  const cookie = request.cookies.get('NEXT_LOCALE')?.value;
  const url = request.nextUrl.clone();
  url.pathname = `/${isLocale(cookie) ? cookie : DEFAULT_LOCALE}${pathname === '/' ? '' : pathname}`;
  return NextResponse.redirect(url, 307);
}

export const config = {
  // The admin pages, plus everything except APIs, the staff app, Next internals and files with an extension.
  matcher: ['/admin', '/admin/:path*', '/((?!(?:admin|api|staff)(?:/|$)|_next/|.*\\.\\w+$).*)'],
};
