import type { Metadata } from 'next';
import { Geist, Fraunces } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers/Providers';

const geist = Geist({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-geist',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-fraunces',
  axes: ['SOFT'],
});

export const metadata: Metadata = {
  applicationName: 'Anamneo',
  title: {
    default: 'Anamneo',
    template: '%s | Anamneo',
  },
  description: 'Sistema de gestión de fichas clínicas para atención médica',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${geist.variable} ${fraunces.variable}`}>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
