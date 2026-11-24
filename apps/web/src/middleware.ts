import { type NextRequest, NextResponse } from 'next/server';
import { resolveRouteAccess, ROLE_COOKIE } from './lib/auth/routes';

/**
 * Role-based redirects from the `od_role` hint cookie (the httpOnly refresh cookie is scoped to
 * /api/v1/auth, so it never reaches middleware). This is UX only — the API enforces every rule.
 * Rules live in `lib/auth/routes.ts` (`resolveRouteAccess`) and are unit-tested there.
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const target = resolveRouteAccess(pathname, search, request.cookies.get(ROLE_COOKIE)?.value);
  if (!target) return NextResponse.next();
  return NextResponse.redirect(new URL(target, request.url));
}

export const config = {
  matcher: ['/cabinet/:path*', '/admin/:path*'],
};
