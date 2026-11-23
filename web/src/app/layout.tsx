import type { Metadata, Viewport } from 'next';
import { NOVA_INDEXABLE, NOVA_SITE_URL } from '@/lib/site';
import { Appearance } from '@/components/appearance';
import './globals.css';

export const metadata: Metadata = {
  title: 'NOVA — личные диалоги',
  description: 'NOVA — мессенджер для личных диалогов. Зарегистрируйтесь по электронной почте и начните переписку.',
  applicationName: 'NOVA',
  ...(NOVA_SITE_URL ? { metadataBase: NOVA_SITE_URL, alternates: { canonical: '/' } } : {}),
  robots: { index: NOVA_INDEXABLE, follow: NOVA_INDEXABLE },
  verification: NOVA_INDEXABLE ? { google: process.env.NOVA_GOOGLE_SITE_VERIFICATION } : undefined,
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [{ media: '(prefers-color-scheme: light)', color: '#edf7f4' }, { media: '(prefers-color-scheme: dark)', color: '#101722' }],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body><Appearance>{children}</Appearance></body></html>;
}
