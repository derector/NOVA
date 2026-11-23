import type { MetadataRoute } from 'next';
import { NOVA_SITE_URL } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: NOVA_SITE_URL && new URL('/sitemap.xml', NOVA_SITE_URL).href,
  };
}
