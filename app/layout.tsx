import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Campus Connect LPU – Centralized Study Material Hub',
  description: 'Your one-stop academic library for Lovely Professional University. Access subject notes, solved mid-term & end-term papers, and previous year questions (PYQs).',
  keywords: 'LPU, Campus Connect, LPU study material, Lovely Professional University, CSE101 notes, LPU pyqs, mid term papers, end term papers',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 antialiased selection:bg-orange-500 selection:text-white">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
