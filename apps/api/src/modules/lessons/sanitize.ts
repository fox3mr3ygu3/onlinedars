/**
 * Defensive clean-up of admin-authored rich text (lesson TEXT materials) before storage.
 * Removes active content: <script>/<style>/<iframe>/<object>/<embed>/<form> blocks, inline
 * event handlers (on*=), and javascript:/vbscript:/data: URLs in href/src.
 *
 * This is a server-side backstop, not a full HTML sanitiser: the web must still render lesson
 * HTML through an allow-list sanitiser (e.g. DOMPurify). See docs/DECISIONS.md.
 */
const BLOCK_TAGS = ['script', 'style', 'iframe', 'object', 'embed', 'form', 'frame', 'frameset'];

export function sanitizeRichText(html: string): string {
  let out = html;
  for (const tag of BLOCK_TAGS) {
    out = out.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, 'gi'), '');
    out = out.replace(new RegExp(`<\\/?${tag}\\b[^>]*>`, 'gi'), '');
  }
  out = out.replace(/<(meta|link|base)\b[^>]*>/gi, '');
  // on*="..." / on*='...' / on*=bare
  out = out.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  // dangerous URL schemes in href/src/xlink:href/action/formaction
  out = out.replace(
    /\s+(href|src|xlink:href|action|formaction)\s*=\s*("|')?\s*(javascript|vbscript|data):[^"'>\s]*("|')?/gi,
    '',
  );
  // srcdoc can carry a whole document
  out = out.replace(/\s+srcdoc\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  return out;
}
