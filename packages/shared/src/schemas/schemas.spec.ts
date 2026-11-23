import { describe, expect, it } from 'vitest';
import { QuestionType } from '../enums';
import { registerSchema, loginSchema } from './auth';
import { courseInputSchema, questionInputSchema, blankIndexesIn } from './content';
import { normalizeUzPhone, parseLoginIdentifier } from './identity';
import { createOrderSchema } from './payments';

describe('identity helpers', () => {
  it('normalises Uzbek phone numbers', () => {
    expect(normalizeUzPhone('+998 90 123 45 67')).toBe('+998901234567');
    expect(normalizeUzPhone('901234567')).toBe('+998901234567');
    expect(normalizeUzPhone('998901234567')).toBe('+998901234567');
    expect(normalizeUzPhone('12345')).toBeNull();
  });

  it('detects email vs phone logins', () => {
    expect(parseLoginIdentifier(' Ali@Example.UZ ')).toEqual({
      kind: 'email',
      email: 'ali@example.uz',
    });
    expect(parseLoginIdentifier('90 123 45 67')).toEqual({ kind: 'phone', phone: '+998901234567' });
    expect(parseLoginIdentifier('not-valid')).toBeNull();
  });
});

describe('auth schemas', () => {
  it('requires email or phone', () => {
    expect(
      registerSchema.safeParse({ fullName: 'Ali Valiyev', password: 'secret123' }).success,
    ).toBe(false);
  });

  it('requires an OTP for phone sign-up', () => {
    const r = registerSchema.safeParse({
      fullName: 'Ali',
      phone: '901234567',
      password: 'secret123',
    });
    expect(r.success).toBe(false);
    const ok = registerSchema.parse({
      fullName: 'Ali',
      phone: '901234567',
      password: 'secret123',
      otpCode: '123456',
    });
    expect(ok.phone).toBe('+998901234567');
  });

  it('lowercases emails', () => {
    const r = registerSchema.parse({ fullName: 'Ali', email: 'ALI@X.UZ', password: 'secret123' });
    expect(r.email).toBe('ali@x.uz');
  });

  it('rejects short passwords', () => {
    expect(
      registerSchema.safeParse({ fullName: 'Ali', email: 'a@b.uz', password: '123' }).success,
    ).toBe(false);
  });

  it('rejects an unparseable login', () => {
    expect(loginSchema.safeParse({ login: 'abc', password: 'x' }).success).toBe(false);
  });
});

describe('content schemas', () => {
  it('enforces free/paid price rules', () => {
    const base = { slug: 'js-asoslari', title: 'JS asoslari' };
    expect(courseInputSchema.safeParse({ ...base, isFree: true, price: 100 }).success).toBe(false);
    expect(courseInputSchema.safeParse({ ...base, isFree: false, price: 0 }).success).toBe(false);
    expect(courseInputSchema.safeParse({ ...base, isFree: false, price: 50_000_00 }).success).toBe(
      true,
    );
  });

  it('validates single-choice questions have exactly one correct option', () => {
    const q = {
      type: QuestionType.MULTIPLE_CHOICE,
      prompt: '2+2?',
      options: [
        { text: '4', isCorrect: true },
        { text: '5', isCorrect: true },
      ],
    };
    expect(questionInputSchema.safeParse(q).success).toBe(false);
    expect(questionInputSchema.safeParse({ ...q, isMultiple: true }).success).toBe(true);
  });

  it('validates TRUE_FALSE shape', () => {
    const q = {
      type: QuestionType.TRUE_FALSE,
      prompt: 'Yer dumaloq',
      options: [
        { text: "To'g'ri", isCorrect: true },
        { text: "Noto'g'ri", isCorrect: false },
      ],
    };
    expect(questionInputSchema.safeParse(q).success).toBe(true);
    expect(questionInputSchema.safeParse({ ...q, options: [q.options[0]] }).success).toBe(false);
  });

  it('validates MATCHING requires pairs', () => {
    const q = {
      type: QuestionType.MATCHING,
      prompt: 'Moslang',
      options: [{ text: 'HTML', matchText: 'Tuzilma' }, { text: 'CSS' }],
    };
    expect(questionInputSchema.safeParse(q).success).toBe(false);
  });

  it('validates FILL_BLANK answers match placeholders', () => {
    expect(blankIndexesIn('a {{0}} b {{1}} {{0}}')).toEqual([0, 1]);
    const q = {
      type: QuestionType.FILL_BLANK,
      prompt: '{{0}} — dasturlash tili',
      options: [{ text: 'JavaScript', blankIndex: 0 }],
    };
    expect(questionInputSchema.safeParse(q).success).toBe(true);
    expect(questionInputSchema.safeParse({ ...q, prompt: 'no blanks' }).success).toBe(false);
  });

  it('requires an image for IMAGE_BASED', () => {
    const q = {
      type: QuestionType.IMAGE_BASED,
      prompt: 'Rasmda nima?',
      options: [{ text: 'Mushuk', isCorrect: true }, { text: 'It' }],
    };
    expect(questionInputSchema.safeParse(q).success).toBe(false);
    expect(
      questionInputSchema.safeParse({ ...q, imageUrl: 'https://example.com/cat.png' }).success,
    ).toBe(true);
  });
});

describe('payments schemas', () => {
  it('never accepts a client amount', () => {
    const parsed = createOrderSchema.parse({ courseId: 'c1', provider: 'PAYME', amount: 1 });
    expect(parsed).not.toHaveProperty('amount');
  });
});
