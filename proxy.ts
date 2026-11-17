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

  // Staff screens (M3.1): no staff session cookie → sign-in first. Only an optimistic check: every staff page verifies
  // the session with Payload itself (app/(staff)/staff/session.ts).
  if (pathname === '/staff' || pathname.startsWith('/staff/')) {
    if (pathname === '/staff/login' || request.cookies.has('payload-token')) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = '/staff/login';
    url.search = `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
    return NextResponse.redirect(url, 307);
  }

  // Customer area: a visitor without the session cookie goes to sign-in before anything renders (a redirect thrown
  // while rendering breaks Next's instant-navigation check). An expired session is handled by the page itself.
  const account = /^\/(fr|en|de|pt)\/account(\/|$)/.exec(pathname);
  if (account && !request.cookies.has('gg_customer')) {
    const url = request.nextUrl.clone();
    url.pathname = `/${account[1]}/auth`;
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url, 307);
  }

  // Website: French is always the entry language; a language picked in the switcher (NEXT_LOCALE cookie) wins.
  if (isLocale(pathname.split('/')[1])) return NextResponse.next();
  const cookie = request.cookies.get('NEXT_LOCALE')?.value;
  const url = request.nextUrl.clone();
  url.pathname = `/${isLocale(cookie) ? cookie : DEFAULT_LOCALE}${pathname === '/' ? '' : pathname}`;
  return NextResponse.redirect(url, 307);
}

export const config = {
  // The admin pages, the staff screens, plus everything except APIs, Next internals and files with an extension.
  matcher: ['/admin', '/admin/:path*', '/staff', '/staff/:path*', '/((?!(?:admin|api|staff)(?:/|$)|_next/|.*\\.\\w+$).*)'],
};
