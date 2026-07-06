'use client';

import { useEffect, useState } from 'react';
import { ApiError, api } from '@/lib/api';

interface Booking {
  id: string;
  scheduledStart: string;
  durationMinutes: number;
  priceTotal: string;
  platformCommission: string;
  workerPayout: string;
  status: string;
  owner: { name: string; email: string | null; phone: string | null };
  workerProfile: { user: { name: string } };
  pet: { name: string };
  payment: { status: string; paymentMethod: string } | null;
}

const STATUS_FILTERS = [
  { value: '', label: 'Semua' },
  { value: 'pending', label: 'Menunggu' },
  { value: 'accepted', label: 'Diterima' },
  { value: 'in_progress', label: 'Berlangsung' },
  { value: 'completed', label: 'Selesai' },
  { value: 'cancelled', label: 'Dibatalkan' },
  { value: 'rejected', label: 'Ditolak' },
];

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  accepted: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-indigo-100 text-indigo-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-700',
  rejected: 'bg-red-100 text-red-800',
};

function formatRupiah(value: string): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(
    Number(value),
  );
}

export default function BookingsPage() {
  const [status, setStatus] = useState('');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .get<Booking[]>(`/bookings/admin/all${status ? `?status=${status}` : ''}`)
      .then(setBookings)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Gagal memuat data booking'))
      .finally(() => setLoading(false));
  }, [status]);

  const totalCommission = bookings
    .filter((b) => b.status === 'completed')
    .reduce((sum, b) => sum + Number(b.platformCommission), 0);

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-gray-900">Booking & Transaksi</h1>

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatus(f.value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              status === f.value ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 border border-gray-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mb-4 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
        Total komisi platform (booking selesai, filter saat ini):{' '}
        <span className="font-semibold text-gray-900">{formatRupiah(String(totalCommission))}</span>
      </div>

      {error && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <p className="text-sm text-gray-400">Memuat...</p>
      ) : bookings.length === 0 ? (
        <p className="text-sm text-gray-400">Tidak ada booking dengan filter ini.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Jadwal</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Worker</th>
                <th className="px-4 py-3">Hewan</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Komisi</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Pembayaran</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bookings.map((b) => (
                <tr key={b.id}>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(b.scheduledStart).toLocaleString('id-ID')}
                  </td>
                  <td className="px-4 py-3 text-gray-900">{b.owner.name}</td>
                  <td className="px-4 py-3 text-gray-900">{b.workerProfile.user.name}</td>
                  <td className="px-4 py-3 text-gray-600">{b.pet.name}</td>
                  <td className="px-4 py-3 text-gray-600">{formatRupiah(b.priceTotal)}</td>
                  <td className="px-4 py-3 text-gray-600">{formatRupiah(b.platformCommission)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[b.status] ?? 'bg-gray-100 text-gray-700'}`}
                    >
                      {b.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{b.payment?.status ?? 'belum dibuat'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
