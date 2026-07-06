'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AdminSession, clearSession, getSession, isAdmin } from '@/lib/auth';

const NAV_ITEMS = [
  { href: '/dashboard/workers', label: 'Verifikasi Worker' },
  { href: '/dashboard/bookings', label: 'Booking & Transaksi' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<AdminSession | null | undefined>(undefined);

  useEffect(() => {
    const current = getSession();
    if (!isAdmin(current)) {
      router.replace('/login');
      return;
    }
    setSession(current);
  }, [router]);

  function handleLogout() {
    clearSession();
    router.replace('/login');
  }

  if (session === undefined) {
    return <div className="flex min-h-screen items-center justify-center text-gray-400">Memuat...</div>;
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-lg font-semibold text-brand-700">PetWalk Admin</span>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>{session?.user.name}</span>
            <button onClick={handleLogout} className="text-brand-600 hover:underline">
              Keluar
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 px-6">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`border-b-2 px-3 py-2 text-sm font-medium ${
                pathname === item.href
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
