/** Absolute site origin for metadataBase, canonical URLs and the sitemap. */
export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  try {
    return new URL(raw).origin;
  } catch {
    return 'http://localhost:3000';
  }
}

/** Plain-text excerpt for meta descriptions (strips tags, collapses whitespace). */
export function excerpt(text: string | null | undefined, max = 160): string | undefined {
  if (!text) return undefined;
  const plain = text
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!plain) return undefined;
  return plain.length > max ? `${plain.slice(0, max - 1).trimEnd()}…` : plain;
}
