/**
 * Live preview of a certificate template. Placeholders use `{{name}}`. The real PDF is rendered
 * server-side (backend-learning); keep the placeholder list in sync with its template engine.
 */
export const CERTIFICATE_PLACEHOLDERS = [
  'fullName',
  'courseTitle',
  'issueDate',
  'certificateId',
  'verifyUrl',
  'backgroundImageUrl',
] as const;
export type CertificatePlaceholder = (typeof CERTIFICATE_PLACEHOLDERS)[number];

export type PreviewData = Record<CertificatePlaceholder, string>;

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Replaces `{{ key }}` with HTML-escaped sample values; unknown placeholders are left as-is. */
export function renderCertificatePreview(html: string, data: PreviewData): string {
  return html.replace(/\{\{\s*([a-zA-Z]+)\s*\}\}/g, (whole, key: string) =>
    (CERTIFICATE_PLACEHOLDERS as readonly string[]).includes(key)
      ? escapeHtml(data[key as CertificatePlaceholder])
      : whole,
  );
}

/** Placeholders the template doesn't use (shown as a hint; fullName etc. are required by the rules). */
export function missingPlaceholders(html: string): CertificatePlaceholder[] {
  const required: CertificatePlaceholder[] = ['fullName', 'courseTitle', 'issueDate', 'certificateId', 'verifyUrl'];
  return required.filter((k) => !new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`).test(html));
}

export const DEFAULT_CERTIFICATE_HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: A4 landscape; margin: 0; }
  body { margin: 0; font-family: Georgia, serif; color: #1e293b; }
  .page { width: 297mm; height: 210mm; box-sizing: border-box; padding: 24mm; text-align: center;
    background: #fff url('{{backgroundImageUrl}}') center / cover no-repeat; }
  h1 { font-size: 40px; margin: 0 0 12mm; letter-spacing: 2px; }
  .name { font-size: 34px; font-weight: bold; margin: 8mm 0; }
  .course { font-size: 22px; }
  .meta { position: absolute; bottom: 20mm; left: 24mm; right: 24mm; display: flex;
    justify-content: space-between; font-size: 13px; }
</style>
</head>
<body>
  <div class="page">
    <h1>SERTIFIKAT</h1>
    <div class="name">{{fullName}}</div>
    <div class="course">«{{courseTitle}}» kursini muvaffaqiyatli tamomladi</div>
    <div class="meta">
      <span>Sana: {{issueDate}}</span>
      <span>ID: {{certificateId}}</span>
      <span>{{verifyUrl}}</span>
    </div>
  </div>
</body>
</html>`;
