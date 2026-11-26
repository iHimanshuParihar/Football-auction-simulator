import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'UCL Mega-Auction & 3D Match Simulator',
  description:
    'UEFA Champions League transfer mega-auction, tactical 1-4-3-3 whiteboard, and real-time Three.js 3D stadium broadcast match simulator.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className="h-full antialiased dark">
      <body className="min-h-full bg-[#040816] text-slate-100 flex flex-col selection:bg-cyan-400/30 selection:text-cyan-100">
        {children}
      </body>
    </html>
  );
}
