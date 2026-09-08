import type { Metadata } from 'next';
import SessionGuard from '@/components/session-guard';
import './globals.css';
import './session.css';
export const metadata: Metadata = { title: 'Management | Plan & Feedback', description: 'Clear expectations, structured feedback, and verified follow-through.', robots: { index: false, follow: false } };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body><SessionGuard/>{children}</body></html>; }
