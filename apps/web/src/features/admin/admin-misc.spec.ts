import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';
import messages from '../../../messages/uz.json';
import {
  renderCertificatePreview,
  missingPlaceholders,
  DEFAULT_CERTIFICATE_HTML,
} from './certificates/preview';
import { somToTiyin, tiyinToSom } from './common/money';
import { dateInputToIso, formatDateTime } from './common/format';
import { courseFieldFor, emptyCourseForm, slugify, toCourseInput } from './courses/courseFormModel';
import { nextStatuses } from './courses/CourseStatus';
import { courseInputSchema } from '@onlinedars/shared';

function keys(obj: unknown, prefix = ''): string[] {
  if (typeof obj === 'string') return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    keys(v, prefix ? `${prefix}.${k}` : k),
  );
}

describe('admin messages', () => {
  it('every admin.* message is valid ICU and formats with sample values', () => {
    const t = createTranslator({ locale: 'uz', messages, namespace: 'admin' });
    const values = {
      count: 1,
      required: 4,
      have: 1,
      need: 24,
      n: '{{0}}',
      page: 1,
      pages: 2,
      name: 'x',
      position: 1,
      points: 1,
      pool: 1,
      list: 'x',
      course: 'x',
      date: 'x',
    };
    for (const k of keys(messages.admin)) {
      expect(() => t(k as never, values as never), k).not.toThrow();
      expect(t(k as never, values as never), k).not.toBe(`admin.${k}`);
    }
  });

  it('literal {{0}} placeholders survive ICU quoting', () => {
    const t = createTranslator({ locale: 'uz', messages, namespace: 'admin.questionEditor' });
    expect(t('promptFillBlankHint')).toContain('{{0}}');
    expect(t('blankLabel', { n: '{{1}}' })).toBe("Bo'sh joy {{1}}");
  });
});

describe("money: so'm shown, tiyin sent", () => {
  it('converts', () => {
    expect(somToTiyin('499 000')).toBe(49_900_000);
    expect(somToTiyin('12,5')).toBe(1250);
    expect(somToTiyin('abc')).toBe(0);
    expect(somToTiyin(-5)).toBe(0);
    expect(tiyinToSom(49_900_000)).toBe(499_000);
  });

  it('course form sends tiyin and forces 0 for free courses', () => {
    const paid = toCourseInput({
      ...emptyCourseForm,
      title: 'Python',
      slug: 'python',
      priceSom: '499000',
    });
    expect(paid.price).toBe(49_900_000);
    expect(courseInputSchema.safeParse(paid).success).toBe(true);

    const free = toCourseInput({
      ...emptyCourseForm,
      title: 'Python',
      slug: 'python',
      isFree: true,
      priceSom: '10',
    });
    expect(free.price).toBe(0);
    expect(courseInputSchema.safeParse(free).success).toBe(true);

    const r = courseInputSchema.safeParse(
      toCourseInput({ ...emptyCourseForm, title: 'Py', slug: 'py', priceSom: '' }),
    );
    expect(r.success).toBe(false);
    if (!r.success) expect(courseFieldFor(r.error.issues[0]!.path)).toBe('priceSom');
  });

  it('goals from lines, slugify', () => {
    expect(toCourseInput({ ...emptyCourseForm, goalsText: ' a \n\n b ' }).goals).toEqual([
      'a',
      'b',
    ]);
    expect(slugify("Python: O'zbekcha asoslar!")).toBe('python-ozbekcha-asoslar');
  });
});

describe('course status transitions', () => {
  it('offers sensible next statuses', () => {
    expect(nextStatuses('DRAFT')).toEqual(['PUBLISHED', 'ARCHIVED']);
    expect(nextStatuses('PUBLISHED')).toContain('HIDDEN');
    expect(nextStatuses('ARCHIVED')).toEqual(['DRAFT']);
  });
});

describe('certificate preview', () => {
  it('replaces placeholders with escaped values and keeps unknown ones', () => {
    const html = '<p>{{ fullName }} — {{courseTitle}} {{unknown}}</p>';
    const out = renderCertificatePreview(html, {
      fullName: '<script>x</script>',
      courseTitle: 'Python',
      issueDate: '',
      certificateId: '',
      verifyUrl: '',
      backgroundImageUrl: '',
    });
    expect(out).toBe('<p>&lt;script&gt;x&lt;/script&gt; — Python {{unknown}}</p>');
  });

  it('default template contains every required placeholder', () => {
    expect(missingPlaceholders(DEFAULT_CERTIFICATE_HTML)).toEqual([]);
    expect(missingPlaceholders('<p>{{fullName}}</p>')).toEqual([
      'courseTitle',
      'issueDate',
      'certificateId',
      'verifyUrl',
    ]);
  });
});

describe('dates', () => {
  it('formats in Tashkent time and converts date inputs', () => {
    expect(formatDateTime('2026-11-20T19:30:00.000Z')).toBe('21.11.2026 00:30');
    expect(formatDateTime(null)).toBe('—');
    expect(dateInputToIso('2026-11-20')).toBe('2026-11-19T19:00:00.000Z');
    expect(dateInputToIso('2026-11-20', true)).toBe('2026-11-20T18:59:59.999Z');
    expect(dateInputToIso('bad')).toBeUndefined();
  });
});
