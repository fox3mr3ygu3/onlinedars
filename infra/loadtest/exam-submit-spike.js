// Spike: many students submit the final exam in the same minute (DEPLOYMENT.md target: 1,000).
// Needs a staging exam and STUDENTS pre-created, enrolled students whose lessons are complete.
//   k6 run -e BASE_URL=https://staging.onlinedars.uz -e EXAM_ID=<id> \
//          -e STUDENTS=1000 -e STUDENT_PASSWORD=... infra/loadtest/exam-submit-spike.js
import http from 'k6/http';
import { check, fail, sleep } from 'k6';
import exec from 'k6/execution';
import { API, authHeaders, guardTarget, jsonHeaders, studentCredentials } from './lib/config.js';

const STUDENTS = Number(__ENV.STUDENTS || 1000);
const EXAM_ID = __ENV.EXAM_ID || '';
// Paths are configurable until the exams API is final (backend-learning owns it).
const START_PATH = __ENV.EXAM_START_PATH || '/exams/{examId}/attempts';
const SUBMIT_PATH = __ENV.EXAM_SUBMIT_PATH || '/exams/{examId}/attempts/{attemptId}/submit';

export const options = {
  setupTimeout: '10m',
  scenarios: {
    // Everyone starts within ~1 minute, as in a real scheduled exam.
    spike: {
      executor: 'per-vu-iterations',
      vus: STUDENTS,
      iterations: 1,
      maxDuration: '15m',
    },
  },
  thresholds: {
    'http_req_failed{name:submit}': ['rate<0.01'],
    'http_req_duration{name:submit}': ['p(95)<1500', 'p(99)<3000'],
    'http_req_duration{name:start}': ['p(95)<1000'],
    checks: ['rate>0.99'],
  },
};

export function setup() {
  guardTarget();
  if (!EXAM_ID) fail('set -e EXAM_ID=<staging exam id>');
  if (!__ENV.STUDENT_PASSWORD) fail('set -e STUDENT_PASSWORD=<load-test student password>');
  const tokens = [];
  for (let i = 1; i <= STUDENTS; i++) {
    const res = http.post(`${API}/auth/login`, JSON.stringify(studentCredentials(i)), {
      headers: jsonHeaders,
      tags: { name: 'login' },
    });
    if (res.status !== 200 && res.status !== 201)
      fail(`login failed for student ${i}: ${res.status}`);
    tokens.push(res.json('accessToken'));
  }
  return { tokens };
}

export default function (data) {
  const token = data.tokens[(exec.vu.idInTest - 1) % data.tokens.length];
  // Spread the starts over the first 60 s.
  sleep(Math.random() * 60);

  const start = http.post(url(START_PATH, {}), null, {
    headers: authHeaders(token),
    tags: { name: 'start' },
  });
  if (!check(start, { 'start 2xx': (r) => r.status >= 200 && r.status < 300 })) return;
  const attempt = start.json();
  const questions = attempt.questions || [];
  check(questions, {
    'no correct answers leaked': (qs) => !JSON.stringify(qs).match(/"isCorrect"|"correctAnswer"/),
  });

  // Students "think" for a while, then everyone submits close together.
  sleep(30 + Math.random() * 60);

  const answers = questions.map((q) => ({ questionId: q.id, answer: pickAnswer(q) }));
  const submit = http.post(
    url(SUBMIT_PATH, { attemptId: attempt.id }),
    JSON.stringify({ answers }),
    {
      headers: authHeaders(token),
      tags: { name: 'submit' },
    },
  );
  check(submit, {
    'submit 2xx': (r) => r.status >= 200 && r.status < 300,
    'graded on server': (r) => r.status >= 300 || typeof safe(r, 'score') === 'number',
  });
}

function url(path, vars) {
  return API + path.replace('{examId}', EXAM_ID).replace('{attemptId}', vars.attemptId || '');
}

function pickAnswer(q) {
  const opts = q.options || [];
  if (opts.length) return [opts[Math.floor(Math.random() * opts.length)].id];
  if (q.type === 'TRUE_FALSE') return Math.random() < 0.5;
  return 'loadtest';
}

function safe(res, path) {
  try {
    return res.json(path);
  } catch (_e) {
    return undefined;
  }
}
