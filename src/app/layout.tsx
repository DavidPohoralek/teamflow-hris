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

// Runs synchronously before React — if no SW is controlling this page the browser
// may be serving iOS-cached stale HTML. Redirect to a unique URL so iOS is forced
// to fetch a fresh copy from the network. The _nc param is cleaned up by SWRegister.
const CACHE_BUST_SCRIPT = `(function(){try{
  if(!('serviceWorker' in navigator)||navigator.serviceWorker.controller)return;
  var u=location.href;
  if(u.indexOf('_nc=')>=0)return;
  location.replace(u+(u.indexOf('?')>=0?'&':'?')+'_nc='+Date.now());
}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="cs" className={inter.variable}>
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <head>
        {/* Cache-busting: must run before React so even stale-HTML PWA launches get a fresh page */}
        {/* biome-ignore lint: intentional inline script for pre-hydration execution */}
        <script dangerouslySetInnerHTML={{ __html: CACHE_BUST_SCRIPT }} />
      </head>
      <body className="font-sans antialiased">
        <LangProvider>{children}</LangProvider>
        <SWRegister />
      </body>
    </html>
  );
}
