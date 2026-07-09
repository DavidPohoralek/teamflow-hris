import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { LangProvider } from '@/lib/i18n';
import SWRegister from '@/components/SWRegister';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'TeamFlow',
  description: 'Plánování směn, docházka a správa zaměstnanců',
  authors: [{ name: 'SelbickyLabs' }],
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="cs" className={inter.variable}>
      <body className="font-sans antialiased"><LangProvider>{children}</LangProvider><SWRegister /></body>
    </html>
  );
}
