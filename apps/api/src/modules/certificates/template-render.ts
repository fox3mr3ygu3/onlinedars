/** Fills certificate template placeholders. Values are HTML-escaped (names are user input). */

export interface CertificateTemplateData {
  fullName: string;
  courseTitle: string;
  /** Already formatted for display, e.g. "22.11.2026". */
  issuedAt: string;
  certificateId: string;
  verifyUrl: string;
  backgroundImageUrl: string;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const PLACEHOLDER_RE =
  /\{\{\s*(fullName|courseTitle|issuedAt|certificateId|verifyUrl|backgroundImageUrl)\s*\}\}/g;

export function renderCertificateHtml(html: string, data: CertificateTemplateData): string {
  return html.replace(PLACEHOLDER_RE, (_m, key: keyof CertificateTemplateData) =>
    escapeHtml(data[key] ?? ''),
  );
}

/** dd.mm.yyyy in Asia/Tashkent (Uzbek convention). */
export function formatIssueDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tashkent',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('day')}.${get('month')}.${get('year')}`;
}

export const SAMPLE_TEMPLATE_DATA: Omit<
  CertificateTemplateData,
  'verifyUrl' | 'backgroundImageUrl'
> = {
  fullName: 'Ali Valiyev',
  courseTitle: 'Namuna kurs',
  issuedAt: '01.01.2026',
  certificateId: 'OD-0000-0000-0000',
};
