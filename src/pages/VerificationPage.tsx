/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export default function VerificationPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [beneficiary, setBeneficiary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    setLoading(true);
    const token = localStorage.getItem('token');
    fetch(`/api/beneficiary/${id}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(data => {
        setBeneficiary(data);
        setNotes(data.notes || '');
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch beneficiary:', err);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return <div className="text-center p-12">Memuat data...</div>;
  }

  if (!beneficiary) {
    return <div className="text-center p-12">Data penerima tidak ditemukan.</div>;
  }

  const handleVerification = async (status) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/beneficiary/${id}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status, notes }),
      });

      if (!response.ok) {
        throw new Error('Verification failed');
      }

      // On success, navigate back to the dashboard
      navigate('/');
    } catch (error) { 
      console.error('Error during verification:', error);
      // Optionally, show an error message to the user
      alert('Gagal memperbarui status. Silakan coba lagi.');
    }
  };

  const DetailItem = ({ label, value }) => (
    <div>
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 text-lg text-slate-900">{value}</dd>
    </div>
  );

  return (
    <div className="bg-white shadow-md rounded-xl max-w-4xl mx-auto">
      <div className="p-6 border-b border-slate-200">
        <h2 className="text-2xl font-semibold text-slate-800">Verifikasi Data Penerima</h2>
        <p className="mt-1 text-slate-500">Periksa detail di bawah ini dan berikan status persetujuan.</p>
      </div>
      <div className="p-6">
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8">
          <DetailItem label="Nama Lengkap" value={beneficiary.name} />
          <DetailItem label="Skor Kelayakan" value={beneficiary.score !== null && beneficiary.score !== undefined ? Number(beneficiary.score).toFixed(2) : '-'} />
          <DetailItem label="Penghasilan" value={`Rp ${beneficiary.monthly_income?.toLocaleString('id-ID') || beneficiary.income?.toLocaleString('id-ID') || '-'}`} />
          <DetailItem label="Jumlah Tanggungan" value={`${beneficiary.family_size || beneficiary.dependents || '-'} orang`} />
          <DetailItem label="Status Rumah" value={beneficiary.house_conditions || beneficiary.house_status || '-'} />
          <DetailItem label="Status Saat Ini" value={beneficiary.status} />
        </dl>

        <div className="mt-8">
          <label htmlFor="notes" className="block text-sm font-medium text-slate-700">Catatan Alasan (Opsional)</label>
          <textarea
            id="notes"
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            placeholder="Contoh: Data penghasilan tidak sesuai dengan dokumen..."
          />
        </div>

        <div className="mt-8 pt-6 border-t border-slate-200 flex justify-between items-center">
           <button
            onClick={() => navigate(-1)} // Go back to the previous page
            className="text-sm font-medium text-slate-600 hover:text-slate-800">
            &larr; Kembali ke Dasbor
          </button>
          <div className="flex space-x-4">
            <button 
              onClick={() => handleVerification('Tidak Layak')}
              className="px-6 py-2.5 text-sm font-semibold text-white bg-red-600 rounded-md shadow-sm hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600">
              Tolak
            </button>
            <button 
              onClick={() => handleVerification('Layak')}
              className="px-6 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-md shadow-sm hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">
              Setujui
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
