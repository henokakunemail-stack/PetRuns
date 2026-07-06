import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PetWalk Admin',
  description: 'Dashboard admin PetWalk — verifikasi worker & monitoring booking',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
