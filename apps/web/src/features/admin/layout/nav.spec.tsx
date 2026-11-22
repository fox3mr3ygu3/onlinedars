// @vitest-environment jsdom
import { Role } from '@onlinedars/shared';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderAdmin } from '../test-utils';
import { AdminNav } from './AdminNav';
import { activeNavKey, canAccessAdmin, visibleNavItems } from './nav';

const ADMIN_ONLY = ['students', 'payments', 'reports', 'settings', 'audit'];
const CONTENT = ['dashboard', 'courses', 'exams', 'certificates', 'directions', 'teachers', 'faq'];

describe('role-based admin menu', () => {
  it('ADMIN sees every item', () => {
    expect(visibleNavItems(Role.ADMIN).map((i) => i.key)).toEqual([...CONTENT, ...ADMIN_ONLY]);
  });

  it('CONTENT_MANAGER sees content items only', () => {
    const keys = visibleNavItems(Role.CONTENT_MANAGER).map((i) => i.key);
    expect(keys).toEqual(CONTENT);
    for (const k of ADMIN_ONLY) expect(keys).not.toContain(k);
  });

  it('STUDENT / anonymous see nothing and cannot access the panel', () => {
    expect(visibleNavItems(Role.STUDENT)).toEqual([]);
    expect(visibleNavItems(null)).toEqual([]);
    expect(canAccessAdmin(Role.STUDENT)).toBe(false);
    expect(canAccessAdmin(undefined)).toBe(false);
    expect(canAccessAdmin(Role.CONTENT_MANAGER)).toBe(true);
  });

  it('active item by path', () => {
    expect(activeNavKey('/admin')).toBe('dashboard');
    expect(activeNavKey('/admin/courses/abc/modules')).toBe('courses');
    expect(activeNavKey('/admin/lessons/x/practices')).toBe('courses');
    expect(activeNavKey('/admin/payments')).toBe('payments');
  });

  it('renders the CONTENT_MANAGER menu without payments/settings links', () => {
    renderAdmin(<AdminNav role={Role.CONTENT_MANAGER} activeKey="courses" />);
    expect(screen.getByRole('link', { name: 'Kurslar' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('link', { name: "To'lovlar" })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Sozlamalar' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Audit jurnali' })).toBeNull();
    expect(screen.queryByText('Boshqaruv')).toBeNull();
  });

  it('renders the ADMIN menu with management links', () => {
    renderAdmin(<AdminNav role={Role.ADMIN} activeKey={null} />);
    expect(screen.getByRole('link', { name: "To'lovlar" })).toHaveAttribute(
      'href',
      '/admin/payments',
    );
    expect(screen.getByRole('link', { name: 'Sozlamalar' })).toHaveAttribute(
      'href',
      '/admin/settings',
    );
  });
});
