/**
 * Built-in certificate template, used when neither the course nor the platform has an
 * admin-managed template (`CertificateTemplate`). Placeholders: {{fullName}}, {{courseTitle}},
 * {{issuedAt}}, {{certificateId}}, {{verifyUrl}}, {{backgroundImageUrl}}.
 * Kept as a TS string so `nest build` ships it without asset copying.
 */
export const BUILTIN_CERTIFICATE_HTML = `<!doctype html>
<html lang="uz">
<head>
<meta charset="utf-8" />
<style>
  @page { size: A4 landscape; margin: 0; }
  html, body { margin: 0; padding: 0; }
  body { font-family: 'Inter', 'DejaVu Sans', Arial, sans-serif; color: #0f172a; }
  .wrap { box-sizing: border-box; width: 297mm; height: 210mm; padding: 24mm;
    border: 8mm solid #2563eb; display: flex; flex-direction: column; justify-content: center;
    text-align: center; background-size: cover; background-image: url('{{backgroundImageUrl}}'); }
  h1 { font-size: 40pt; margin: 0 0 8mm; letter-spacing: 2pt; }
  .name { font-size: 30pt; font-weight: 700; margin: 6mm 0; }
  .course { font-size: 18pt; margin-bottom: 12mm; }
  .meta { font-size: 11pt; color: #475569; margin-top: 2mm; }
</style>
</head>
<body>
  <div class="wrap">
    <h1>SERTIFIKAT</h1>
    <div>Ushbu sertifikat</div>
    <div class="name">{{fullName}}</div>
    <div class="course">«{{courseTitle}}» kursini muvaffaqiyatli tamomlaganini tasdiqlaydi.</div>
    <div class="meta">Berilgan sana: {{issuedAt}} · ID: {{certificateId}}</div>
    <div class="meta">Tekshirish: {{verifyUrl}}</div>
  </div>
</body>
</html>
`;
