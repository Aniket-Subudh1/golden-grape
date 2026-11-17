import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { type NextRequest, NextResponse } from 'next/server';
import { SCREENS, screenOf } from '@/app/(staff)/staff/screens';
import { hasRole } from '@/lib/access';
import { env } from '@/lib/env';
import { DEFAULT_LOCALE, isLocale } from '@/lib/i18n';

/**
 * The staff member's roles from Payload's token (HS256, signed with Payload's key: sha256(PAYLOAD_SECRET) as hex, 32
 * characters), or null when the token is missing, forged or expired. Only to answer 404 early: every staff page still
 * checks the session with Payload itself (a signed-out or disabled account goes to sign-in there).
 */
function staffRoles(token: string | undefined): { collection: 'users'; roles: unknown; effectiveRoles: unknown } | null {
  const [header, body, signature] = token?.split('.') ?? [];
  if (!header || !body || !signature) return null;
  const key = createHash('sha256').update(env.PAYLOAD_SECRET).digest('hex').slice(0, 32);
  const expected = createHmac('sha256', key).update(`${header}.${body}`).digest();
  const given = Buffer.from(signature, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { collection?: string; roles?: unknown; effectiveRoles?: unknown; exp?: number };
    if (claims.collection !== 'users' || !claims.exp || claims.exp * 1000 < Date.now()) return null;
    return { collection: 'users', roles: claims.roles, effectiveRoles: claims.effectiveRoles };
  } catch {
    // A token whose payload is not JSON is not ours: the page decides (sign-in).
    return null;
  }
}

export async function proxy(request: NextRequest) {
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
    if (pathname === '/staff/login') return NextResponse.next();
    const token = request.cookies.get('payload-token')?.value;
    if (token) {
      // A screen the role may not open answers a real 404 (AC-M3.1-07): rewritten to a path no route matches.
      const user = staffRoles(token);
      const screen = screenOf(pathname);
      if (user && screen && !hasRole(user, SCREENS[screen].roles)) {
        // The token's roles date from sign-in; the owner may have given this role the screen since (Team & access).
        // Only on a refusal, the server answers from the current rules before the 404.
        const fresh = await fetch(new URL(`/api/staff/can?screen=${screen}`, request.url), { headers: { cookie: request.headers.get('cookie') ?? '' }, cache: 'no-store' })
          .then((r) => r.ok)
          .catch(() => false);
        if (!fresh) return NextResponse.rewrite(new URL('/staff/_not-found', request.url));
      }
      return NextResponse.next();
    }
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
