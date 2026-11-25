// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithIntl } from '@/test/render';
import { PublicHeader } from './public-header';

type User = { fullName: string; role: string; avatarUrl: string | null };
const session = vi.hoisted(() => ({
  value: { user: null, isLoading: false } as { user: User | null; isLoading: boolean },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('@/lib/auth', async (orig) => ({
  ...(await orig<typeof import('@/lib/auth')>()),
  useSession: () => session.value,
}));

beforeEach(() => {
  session.value = { user: null, isLoading: false };
});

describe('<PublicHeader /> account area', () => {
  it('anonymous: login and register, no profile icon', () => {
    renderWithIntl(<PublicHeader />);
    expect(screen.getByRole('link', { name: 'Kirish' })).toHaveAttribute('href', '/login');
    expect(screen.queryByTestId('header-profile')).toBeNull();
  });

  it('student: profile icon with initials and first name links to the profile', () => {
    session.value = {
      user: { fullName: 'Ali Valiyev', role: 'STUDENT', avatarUrl: null },
      isLoading: false,
    };
    renderWithIntl(<PublicHeader />);
    const profile = screen.getByRole('link', { name: 'Profil: Ali Valiyev' });
    expect(profile).toHaveAttribute('href', '/cabinet/profile');
    expect(profile).toHaveTextContent('AV');
    expect(profile).toHaveTextContent('Ali');
    expect(screen.getByRole('button', { name: 'Chiqish' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Kirish' })).toBeNull();
  });

  it('shows the uploaded avatar photo when there is one', () => {
    session.value = {
      user: { fullName: 'Ali Valiyev', role: 'STUDENT', avatarUrl: 'https://cdn.test/a.png' },
      isLoading: false,
    };
    const { container } = renderWithIntl(<PublicHeader />);
    expect(container.querySelector('[data-testid="header-profile"] img')).toHaveAttribute(
      'src',
      'https://cdn.test/a.png',
    );
  });

  it('staff: profile icon goes to the admin panel', () => {
    session.value = {
      user: { fullName: 'Admin User', role: 'ADMIN', avatarUrl: null },
      isLoading: false,
    };
    renderWithIntl(<PublicHeader />);
    expect(screen.getByTestId('header-profile')).toHaveAttribute('href', '/admin');
  });
});
