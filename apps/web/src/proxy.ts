import { getSessionCookie } from 'better-auth/cookies';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC = [
  '/login', '/signup', '/forgot-password', '/reset-password', '/s/', '/setup', '/invite/',
  // Public website pages
  '/welcome', '/pricing', '/demo', '/checkout', '/billing',
];

/** Where the API runs: localhost in development, a tunnel or server URL in production. */
const API_URL = (process.env.API_INTERNAL_URL ?? 'http://localhost:4000').replace(/\/$/, '');

/**
 * The browser only talks to this site; /api/* is forwarded to the API here, so auth
 * cookies stay first-party. Request headers are adjusted on the way:
 * - no Host header: the destination (e.g. an ngrok tunnel) routes by its own host name
 * - ngrok-skip-browser-warning: otherwise ngrok's free plan answers browser-like
 *   requests with an HTML warning page instead of the API response
 */
function forwardToApi(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.set('ngrok-skip-browser-warning', '1');
  return NextResponse.rewrite(new URL(pathname + search, API_URL), { request: { headers } });
}

/** Optimistic redirect based on the session cookie; the API still checks every request. */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith('/api/')) return forwardToApi(request);

  const isPublic = PUBLIC.some(p => pathname.startsWith(p));
  const hasSession = !!getSessionCookie(request, { cookiePrefix: 'chatboat' });

  // One address for everything: visitors who aren't signed in see the landing page at /,
  // signed-in people see the app's home there.
  if (pathname === '/' && !hasSession) return NextResponse.rewrite(new URL('/welcome', request.url));

  if (!hasSession && !isPublic) {
    const url = new URL('/login', request.url);
    url.searchParams.set('next', pathname + search);
    return NextResponse.redirect(url);
  }
  // Signed-in users are sent away from /login client-side, after the session is confirmed.
  // Doing it here from the cookie alone loops when the cookie is stale.
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*', '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)'],
};
