import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Management',
  description: 'Initiatives, KPIs, and communication for managers and their teams.'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
