'use client';

import { useEffect, useState } from 'react';
import { ApiError, api } from '@/lib/api';

interface WorkerProfile {
  id: string;
  bio: string | null;
  verificationStatus: string;
  adminNote: string | null;
  ktpDocumentUrl: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  user: { id: string; name: string; email: string | null; phone: string | null };
}

const STATUS_FILTERS = [
  { value: 'pending', label: 'Menunggu' },
  { value: 'approved', label: 'Disetujui' },
  { value: 'rejected', label: 'Ditolak' },
];

export default function WorkersPage() {
  const [status, setStatus] = useState('pending');
  const [workers, setWorkers] = useState<WorkerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  async function load(currentStatus: string) {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<WorkerProfile[]>(`/worker-profiles/admin/all?status=${currentStatus}`);
      setWorkers(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat data worker');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function handleVerification(id: string, verdict: 'approved' | 'rejected') {
    const adminNote =
      verdict === 'rejected' ? window.prompt('Alasan penolakan (opsional):') ?? undefined : undefined;

    setActioningId(id);
    try {
      await api.patch(`/worker-profiles/${id}/verification`, { status: verdict, adminNote });
      await load(status);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memproses verifikasi');
    } finally {
      setActioningId(null);
    }
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-gray-900">Verifikasi Worker</h1>

      <div className="mb-4 flex gap-2">
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

      {error && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <p className="text-sm text-gray-400">Memuat...</p>
      ) : workers.length === 0 ? (
        <p className="text-sm text-gray-400">Tidak ada worker dengan status ini.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Kontak</th>
                <th className="px-4 py-3">Rekening</th>
                <th className="px-4 py-3">KTP</th>
                {status === 'pending' && <th className="px-4 py-3">Aksi</th>}
                {status === 'rejected' && <th className="px-4 py-3">Catatan Admin</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {workers.map((w) => (
                <tr key={w.id}>
                  <td className="px-4 py-3 font-medium text-gray-900">{w.user.name}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {w.user.email ?? '-'}
                    <br />
                    {w.user.phone ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {w.bankName ?? '-'} {w.bankAccountNumber ?? ''}
                  </td>
                  <td className="px-4 py-3">
                    {w.ktpDocumentUrl ? (
                      <a
                        href={w.ktpDocumentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-600 hover:underline"
                      >
                        Lihat
                      </a>
                    ) : (
                      '-'
                    )}
                  </td>
                  {status === 'pending' && (
                    <td className="space-x-2 px-4 py-3">
                      <button
                        disabled={actioningId === w.id}
                        onClick={() => handleVerification(w.id, 'approved')}
                        className="rounded-md bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                      >
                        Setujui
                      </button>
                      <button
                        disabled={actioningId === w.id}
                        onClick={() => handleVerification(w.id, 'rejected')}
                        className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        Tolak
                      </button>
                    </td>
                  )}
                  {status === 'rejected' && (
                    <td className="px-4 py-3 text-gray-600">{w.adminNote ?? '-'}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
