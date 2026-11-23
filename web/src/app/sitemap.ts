import type { MetadataRoute } from 'next';
import { NOVA_SITE_URL } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  return NOVA_SITE_URL ? [{ url: NOVA_SITE_URL.href }] : [];
}
