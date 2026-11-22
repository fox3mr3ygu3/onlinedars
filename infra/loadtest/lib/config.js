// Shared settings for the k6 scripts. Everything is overridable with -e NAME=value.
import { fail } from 'k6';

export const BASE_URL = (__ENV.BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
export const API = `${BASE_URL}${__ENV.API_PREFIX || '/api/v1'}`;

// Load tests must not hit production unless someone explicitly says so.
export function guardTarget({ neverProduction = false } = {}) {
  const host = BASE_URL.replace(/^https?:\/\//, '').split('/')[0];
  const safe =
    /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host) ||
    /(^|\.)(staging|dev|test)\./.test(host);
  if (safe) return;
  if (neverProduction) fail(`refusing to send payment callbacks to ${host}: staging or local only`);
  if (__ENV.ALLOW_PRODUCTION !== 'yes') {
    fail(
      `refusing to load-test ${host}; set -e ALLOW_PRODUCTION=yes only with an agreed maintenance window`,
    );
  }
}

export const jsonHeaders = { 'Content-Type': 'application/json', Accept: 'application/json' };

export function authHeaders(token) {
  return { ...jsonHeaders, Authorization: `Bearer ${token}` };
}

// Students created for load tests (e.g. by a staging-only seed): loadtest+1@example.test ... +N
export function studentCredentials(i) {
  const pattern = __ENV.STUDENT_EMAIL_PATTERN || 'loadtest+{n}@example.test';
  return {
    login: pattern.replace('{n}', String(i)),
    password: __ENV.STUDENT_PASSWORD || '',
  };
}
