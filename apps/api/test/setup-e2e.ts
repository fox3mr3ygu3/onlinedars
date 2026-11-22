import { loadDotEnv } from '../src/config/env';

// Load the repo-root .env for local runs; CI provides DATABASE_URL / REDIS_URL directly.
loadDotEnv();
process.env.NODE_ENV = 'test';
// Test-only fallbacks so config validation passes when CI doesn't set them.
process.env.JWT_ACCESS_SECRET ||= 'e2e-access-secret-0123456789-abcdefghijkl';
process.env.JWT_REFRESH_SECRET ||= 'e2e-refresh-secret-0123456789-abcdefghijk';
