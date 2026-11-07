import { getSessionCookie } from 'better-auth/cookies';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC = ['/login', '/signup', '/forgot-password', '/reset-password'];

/** Optimistic redirect based on the session cookie; the API still checks every request. */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC.some(p => pathname.startsWith(p));
  const hasSession = !!getSessionCookie(request, { cookiePrefix: 'chatboat' });

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
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)'],
};
