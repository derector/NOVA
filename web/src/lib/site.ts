const configuredSiteUrl = process.env.NEXT_PUBLIC_NOVA_SITE_URL;

function publicSiteUrl(): URL | undefined {
  if (!configuredSiteUrl) return;
  try {
    const url = new URL(configuredSiteUrl);
    if (url.protocol === 'https:' && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash) {
      return url;
    }
  } catch { /* The app works without a configured canonical domain. */ }
}

export const NOVA_SITE_URL = publicSiteUrl();
