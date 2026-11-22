// Anonymous visitors browsing the public catalog: list -> search/filter -> course page.
//   k6 run -e BASE_URL=https://staging.onlinedars.uz infra/loadtest/catalog-browse.js
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { API, BASE_URL, guardTarget, jsonHeaders } from './lib/config.js';

export const options = {
  scenarios: {
    browse: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: Number(__ENV.VUS || 200) },
        { duration: __ENV.HOLD || '5m', target: Number(__ENV.VUS || 200) },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{kind:api}': ['p(95)<400'],
    'http_req_duration{kind:page}': ['p(95)<1200'],
    checks: ['rate>0.99'],
  },
};

const SEARCH_TERMS = ['python', 'excel', 'dizayn', 'ingliz', 'matematika', 'javascript'];

export function setup() {
  guardTarget();
}

export default function () {
  let slug;

  group('catalog', () => {
    const res = http.get(`${API}/courses?page=1&limit=12`, {
      headers: jsonHeaders,
      tags: { kind: 'api', name: 'GET /courses' },
    });
    check(res, { 'catalog 200': (r) => r.status === 200 });
    const items = safeItems(res);
    if (items.length) slug = items[Math.floor(Math.random() * items.length)].slug;
  });
  sleep(1 + Math.random() * 2);

  group('search', () => {
    const q = SEARCH_TERMS[Math.floor(Math.random() * SEARCH_TERMS.length)];
    const res = http.get(`${API}/courses?search=${encodeURIComponent(q)}&page=1&limit=12`, {
      headers: jsonHeaders,
      tags: { kind: 'api', name: 'GET /courses?search' },
    });
    check(res, { 'search 200': (r) => r.status === 200 });
    http.get(`${API}/directions`, {
      headers: jsonHeaders,
      tags: { kind: 'api', name: 'GET /directions' },
    });
  });
  sleep(1 + Math.random() * 2);

  if (slug) {
    group('course page', () => {
      const api = http.get(`${API}/courses/${slug}`, {
        headers: jsonHeaders,
        tags: { kind: 'api', name: 'GET /courses/:slug' },
      });
      check(api, { 'course 200': (r) => r.status === 200 });
      // The rendered page (Next.js server components) when BASE_URL points at the web origin.
      if (__ENV.WEB_PAGES !== 'no') {
        const page = http.get(`${BASE_URL}/courses/${slug}`, {
          tags: { kind: 'page', name: 'PAGE /courses/:slug' },
        });
        check(page, { 'page < 500': (r) => r.status < 500 });
      }
    });
  }
  sleep(2 + Math.random() * 3);
}

function safeItems(res) {
  try {
    const body = res.json();
    return Array.isArray(body) ? body : body.items || body.data || [];
  } catch (_e) {
    return [];
  }
}
