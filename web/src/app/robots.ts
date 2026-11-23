import type { MetadataRoute } from 'next';
import { NOVA_INDEXABLE, NOVA_SITE_URL } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: NOVA_INDEXABLE ? { userAgent: '*', allow: '/' } : { userAgent: '*', disallow: '/' },
    sitemap: NOVA_INDEXABLE && NOVA_SITE_URL ? new URL('/sitemap.xml', NOVA_SITE_URL).href : undefined,
  };
}
