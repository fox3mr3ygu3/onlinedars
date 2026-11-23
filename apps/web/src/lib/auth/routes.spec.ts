import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '../../middleware';
import { resolveRouteAccess, roleHome, safeNextPath } from './routes';

describe('resolveRouteAccess (middleware rules)', () => {
  it('lets public pages through for everyone', () => {
    for (const p of ['/', '/courses', '/courses/js', '/login', '/verify/OD-1', '/cabinetx']) {
      expect(resolveRouteAccess(p, '', undefined)).toBeNull();
      expect(resolveRouteAccess(p, '', 'STUDENT')).toBeNull();
    }
  });

  it('sends unauthenticated users to /login with next (incl. query)', () => {
    expect(resolveRouteAccess('/cabinet', '', undefined)).toBe('/login?next=%2Fcabinet');
    expect(resolveRouteAccess('/admin/courses', '', undefined)).toBe(
      '/login?next=%2Fadmin%2Fcourses',
    );
    expect(resolveRouteAccess('/checkout/result', '?orderId=o1', undefined)).toBe(
      '/login?next=%2Fcheckout%2Fresult%3ForderId%3Do1',
    );
  });

  it('treats an unknown role value as signed out', () => {
    expect(resolveRouteAccess('/admin', '', 'SUPERUSER')).toBe('/login?next=%2Fadmin');
  });

  it('/cabinet is for STUDENT; staff go to /admin', () => {
    expect(resolveRouteAccess('/cabinet/courses', '', 'STUDENT')).toBeNull();
    expect(resolveRouteAccess('/cabinet', '', 'ADMIN')).toBe('/admin');
    expect(resolveRouteAccess('/cabinet', '', 'CONTENT_MANAGER')).toBe('/admin');
  });

  it('/admin is for ADMIN and CONTENT_MANAGER; students go to /cabinet', () => {
    expect(resolveRouteAccess('/admin', '', 'ADMIN')).toBeNull();
    expect(resolveRouteAccess('/admin/lessons/1', '', 'CONTENT_MANAGER')).toBeNull();
    expect(resolveRouteAccess('/admin', '', 'STUDENT')).toBe('/cabinet');
  });

  it('/checkout needs any signed-in role', () => {
    expect(resolveRouteAccess('/checkout/c1', '', 'STUDENT')).toBeNull();
    expect(resolveRouteAccess('/checkout/c1', '', 'ADMIN')).toBeNull();
  });
});

describe('middleware', () => {
  function req(path: string, role?: string) {
    const r = new NextRequest(new URL(path, 'http://localhost:3000'));
    if (role) r.cookies.set('od_role', role);
    return r;
  }

  it('redirects to login without the role cookie', () => {
    const res = middleware(req('/cabinet/payments'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(
      'http://localhost:3000/login?next=%2Fcabinet%2Fpayments',
    );
  });

  it('redirects a student away from /admin', () => {
    const res = middleware(req('/admin', 'STUDENT'));
    expect(res.headers.get('location')).toBe('http://localhost:3000/cabinet');
  });

  it('passes through when the role matches', () => {
    const res = middleware(req('/admin/courses', 'ADMIN'));
    expect(res.headers.get('location')).toBeNull();
    expect(res.headers.get('x-middleware-next')).toBe('1');
  });
});

describe('safeNextPath', () => {
  it('accepts same-site paths', () => {
    expect(safeNextPath('/cabinet/courses?x=1')).toBe('/cabinet/courses?x=1');
  });
  it('rejects open redirects and junk', () => {
    for (const v of [
      null,
      '',
      'https://evil.com',
      '//evil.com',
      '/\\evil.com',
      'cabinet',
      '/a\nb',
    ]) {
      expect(safeNextPath(v)).toBeNull();
    }
  });
});

describe('roleHome', () => {
  it('maps roles to panels', () => {
    expect(roleHome('STUDENT')).toBe('/cabinet');
    expect(roleHome('ADMIN')).toBe('/admin');
    expect(roleHome('CONTENT_MANAGER')).toBe('/admin');
  });
});
