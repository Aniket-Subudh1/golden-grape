import { type NextRequest, NextResponse } from 'next/server';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/lib/i18n';

// NEXT_LOCALE cookie (set by the language switcher), then Accept-Language, then French.
function preferredLocale(request: NextRequest): Locale {
  const cookie = request.cookies.get('NEXT_LOCALE')?.value;
  if (isLocale(cookie)) return cookie;
  const ranked = (request.headers.get('accept-language') ?? '')
    .split(',')
    .map((part) => {
      const [tag, q] = part.trim().split(';q=');
      return { lang: tag.slice(0, 2).toLowerCase(), q: q === undefined ? 1 : Number(q) };
    })
    .sort((a, b) => b.q - a.q);
  return ranked.map((r) => r.lang).find(isLocale) ?? DEFAULT_LOCALE;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isLocale(pathname.split('/')[1])) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = `/${preferredLocale(request)}${pathname === '/' ? '' : pathname}`;
  return NextResponse.redirect(url, 307);
}

export const config = {
  // Everything except the admin, APIs, staff app, Next internals and files with an extension.
  matcher: ['/((?!(?:admin|api|staff)(?:/|$)|_next/|.*\\.\\w+$).*)'],
};
