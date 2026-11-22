import { randomInt } from 'node:crypto';

/** Crockford base32 without I, L, O, U — easy to read aloud and type from a printed PDF. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const GROUPS = 3;
const GROUP_LEN = 4;

/**
 * Human-friendly unique certificate ID, e.g. `OD-7K2M-Q9XD-4HPT` (60 random bits, CSPRNG).
 * Uniqueness is guaranteed by the DB unique index; callers retry on collision.
 */
export function generateCertificatePublicId(rand: (max: number) => number = randomInt): string {
  const groups: string[] = [];
  for (let g = 0; g < GROUPS; g++) {
    let s = '';
    for (let i = 0; i < GROUP_LEN; i++) s += ALPHABET[rand(ALPHABET.length)];
    groups.push(s);
  }
  return `OD-${groups.join('-')}`;
}

const PUBLIC_ID_RE = /^OD-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;

/**
 * Normalises user input for verification: upper-case, trims, maps the Crockford look-alikes
 * (O→0, I/L→1). Returns null if it can't be a certificate ID (saves a DB query).
 */
export function normalizeCertificatePublicId(input: string): string | null {
  const raw = input.trim().toUpperCase();
  const body = raw.startsWith('OD-') ? raw.slice(3) : raw;
  const fixed = body.replace(/O/g, '0').replace(/[IL]/g, '1');
  const compact = fixed.replace(/-/g, '');
  if (compact.length !== GROUPS * GROUP_LEN) return null;
  const grouped = `OD-${compact.slice(0, 4)}-${compact.slice(4, 8)}-${compact.slice(8, 12)}`;
  return PUBLIC_ID_RE.test(grouped) ? grouped : null;
}
