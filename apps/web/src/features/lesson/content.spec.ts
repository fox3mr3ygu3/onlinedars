import { describe, expect, it } from 'vitest';
import { formatBytes, looksLikeHtml, markdownToHtml, toEmbedUrl } from './content';

describe('toEmbedUrl', () => {
  it('converts YouTube and Vimeo URLs', () => {
    expect(toEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    );
    expect(toEmbedUrl('https://youtu.be/dQw4w9WgXcQ?t=10')).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    );
    expect(toEmbedUrl('https://youtube.com/shorts/dQw4w9WgXcQ')).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    );
    expect(toEmbedUrl('https://vimeo.com/123456789')).toBe(
      'https://player.vimeo.com/video/123456789',
    );
  });

  it('returns null for direct files and junk', () => {
    expect(toEmbedUrl('https://files.example.test/video.mp4')).toBeNull();
    expect(toEmbedUrl('not a url')).toBeNull();
    expect(toEmbedUrl('https://youtube.com/watch?v=<script>')).toBeNull();
  });
});

describe('markdownToHtml', () => {
  it('renders headings, lists, emphasis, code and links', () => {
    const html = markdownToHtml(
      '# Sarlavha\n\nMatn **qalin** va *kursiv* `code`\n\n- bir\n- ikki\n\n1. a\n2. b\n\n[havola](https://example.test)',
    );
    expect(html).toContain('<h2>Sarlavha</h2>');
    expect(html).toContain('<strong>qalin</strong>');
    expect(html).toContain('<em>kursiv</em>');
    expect(html).toContain('<code>code</code>');
    expect(html).toContain('<ul>\n<li>bir</li>\n<li>ikki</li>\n</ul>');
    expect(html).toContain('<ol>');
    expect(html).toContain('href="https://example.test"');
  });

  it('escapes raw HTML in markdown and ignores javascript: links', () => {
    const html = markdownToHtml('a <b>x</b> [x](javascript:alert(1))');
    expect(html).not.toContain('<b>');
    expect(html).not.toContain('href="javascript');
  });

  it('keeps code blocks verbatim (escaped)', () => {
    expect(markdownToHtml('```\n<div>\n```')).toBe('<pre><code>&lt;div&gt;</code></pre>');
  });

  it('detects HTML', () => {
    expect(looksLikeHtml('<p>salom</p>')).toBe(true);
    expect(looksLikeHtml('2 < 3')).toBe(false);
  });
});

describe('formatBytes', () => {
  it('formats sizes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(formatBytes(null)).toBe('');
  });
});
