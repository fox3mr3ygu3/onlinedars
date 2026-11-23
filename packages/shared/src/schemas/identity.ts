import { z } from 'zod';

/**
 * Normalises an Uzbek phone number to E.164 (`+998XXXXXXXXX`).
 * Accepts `+998 90 123 45 67`, `998901234567`, `90 123-45-67`. Returns null if invalid.
 */
export function normalizeUzPhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (/^\d{9}$/.test(digits)) return `+998${digits}`;
  if (/^998\d{9}$/.test(digits)) return `+${digits}`;
  return null;
}

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type LoginIdentifier = { kind: 'email'; email: string } | { kind: 'phone'; phone: string };

/** Decides whether a login string is an email or a phone, and normalises it. */
export function parseLoginIdentifier(login: string): LoginIdentifier | null {
  const value = login.trim();
  if (value.includes('@')) {
    const email = normalizeEmail(value);
    return EMAIL_RE.test(email) ? { kind: 'email', email } : null;
  }
  const phone = normalizeUzPhone(value);
  return phone ? { kind: 'phone', phone } : null;
}

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .regex(EMAIL_RE, { message: 'validation.email' });

export const phoneSchema = z
  .string()
  .trim()
  .max(32)
  .refine((v) => normalizeUzPhone(v) !== null, { message: 'validation.phone' })
  .transform((v) => normalizeUzPhone(v) as string);

export const loginIdentifierSchema = z
  .string()
  .trim()
  .min(3)
  .max(254)
  .refine((v) => parseLoginIdentifier(v) !== null, { message: 'validation.login' });
