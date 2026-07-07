import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Aidatom — Akıllı Aidat Yönetim Sistemi',
  description: 'Site yöneticileri ve profesyonel site yönetim şirketleri için aidat takibi, alacak yönetimi ve icra takip sistemi. Aidatlarınızı kolayca yönetin.',
  keywords: ['aidat yönetimi', 'site yönetimi', 'aidat takibi', 'icra takibi', 'apartman yönetimi'],
  authors: [{ name: 'Aidatom' }],
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
      <body>
        {children}
      </body>
    </html>
  );
}
