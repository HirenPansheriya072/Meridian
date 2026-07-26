import type { Metadata } from 'next';
import { Instrument_Serif, Instrument_Sans, JetBrains_Mono } from 'next/font/google';
import { QueryProvider } from '@/providers/query-provider';
import './globals.css';

const display = Instrument_Serif({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400'],
  display: 'swap',
});

const body = Instrument_Sans({ subsets: ['latin'], variable: '--font-body', display: 'swap' });

// Times are read in columns constantly here, so the mono face is doing real work.
const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Meridian — scheduling across timezones',
  description: 'Booking that shows both clocks, and never loses an hour to daylight saving.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
