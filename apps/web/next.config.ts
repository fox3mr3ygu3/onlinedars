import path from 'node:path';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// Server-side target for the /api/v1 proxy (browser calls stay same-origin, so the
// httpOnly refresh cookie scoped to /api/v1/auth works in dev and behind Caddy).
const apiUrl = (process.env.API_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/, '');

const nextConfig: NextConfig = {
  // Standalone output (used by the Docker image) copies pnpm symlinks, which Windows only allows
  // with Developer Mode. Docker/CI build on Linux; set NEXT_STANDALONE=1 to force it locally.
  // Netlify packages the app with its own Next.js runtime, so it skips standalone.
  output:
    process.env.NETLIFY !== 'true' &&
    (process.platform !== 'win32' || process.env.NEXT_STANDALONE === '1')
      ? 'standalone'
      : undefined,
  outputFileTracingRoot: path.join(__dirname, '../../'),
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@onlinedars/shared'],
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${apiUrl}/:path*` }];
  },
};

export default withNextIntl(nextConfig);
