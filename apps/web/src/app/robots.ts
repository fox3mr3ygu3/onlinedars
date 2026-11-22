import type { MetadataRoute } from 'next';
import { siteUrl } from '@/features/catalog/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/cabinet', '/admin', '/checkout', '/api', '/verify/'],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
