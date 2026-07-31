import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Aidatom — Akıllı Aidat Yönetim Sistemi',
  description: 'Site yöneticileri ve profesyonel site yönetim şirketleri için aidat takibi, alacak yönetimi ve icra takip sistemi. Aidatlarınızı kolayca yönetin.',
  keywords: ['aidat yönetimi', 'site yönetimi', 'aidat takibi', 'icra takibi', 'apartman yönetimi'],
  authors: [{ name: 'Aidatom' }],
  manifest: '/site.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
      { url: '/favicon.ico', type: 'image/x-icon' },
    ],
    shortcut: '/favicon.ico',
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  openGraph: {
    title: 'Aidatom — Akıllı Aidat Yönetim Sistemi',
    description: 'Site yöneticileri için profesyonel aidat ve alacak yönetim platformu.',
    type: 'website',
    locale: 'tr_TR',
    siteName: 'Aidatom',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <head>
        <link rel="icon" type="image/png" href="/favicon-96x96.png" sizes="96x96" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
