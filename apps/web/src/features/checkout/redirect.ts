/**
 * Only follow provider redirect URLs that are plain http(s) (https outside localhost), so a bad or
 * tampered API response can never navigate to `javascript:` or similar.
 */
export function isSafeRedirectUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol === 'https:') return true;
  return url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
}

export function cabinetCourseHref(courseId: string): string {
  return `/cabinet/courses/${encodeURIComponent(courseId)}`;
}
