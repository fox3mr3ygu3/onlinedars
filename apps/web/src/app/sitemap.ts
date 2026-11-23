import type { MetadataRoute } from 'next';
import { siteUrl } from '@/features/catalog/seo';
import { getCourses } from '@/lib/api/public';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const pages: MetadataRoute.Sitemap = [
    '',
    '/courses',
    '/directions',
    '/teachers',
    '/faq',
    '/verify',
  ].map((p) => ({ url: `${base}${p}`, changeFrequency: 'weekly', priority: p === '' ? 1 : 0.7 }));
  try {
    const { items } = await getCourses({ page: 1, pageSize: 100 });
    for (const c of items) {
      pages.push({ url: `${base}/courses/${c.slug}`, changeFrequency: 'weekly', priority: 0.8 });
    }
  } catch {
    // API down: static pages only
  }
  return pages;
}
