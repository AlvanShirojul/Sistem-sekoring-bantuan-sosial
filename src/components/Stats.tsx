/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const StatCard = ({ title, value, description }) => (
  <div className="bg-white p-4 md:p-6 rounded-xl border border-slate-200">
    <p className="text-xs md:text-sm font-medium text-slate-500">{title}</p>
    <p className="mt-1 text-2xl md:text-3xl font-semibold text-slate-900">{value}</p>
    {description && <p className="mt-1 text-xs md:text-sm text-slate-500">{description}</p>}
  </div>
);

const EMPTY_STATS = {
  total: 0,
  averageIncome: 0,
  layakPercentage: 0,
  chartData: [
    {
      name: 'Status Kelayakan',
      Layak: 0,
      'Tidak Layak': 0,
      Pending: 0,
    },
  ],
};

function computePeriodStats(data) {
  if (!Array.isArray(data) || data.length === 0) {
    return EMPTY_STATS;
  }

  const total = data.length;
  const beneficiariesWithIncome = data.filter((b) => (
    b.income !== null &&
    b.income !== undefined &&
    b.income !== '' &&
    Number.isFinite(Number(b.income))
  ));

  const totalIncome = beneficiariesWithIncome.reduce((sum, b) => sum + Number(b.income), 0);
  const averageIncome = beneficiariesWithIncome.length > 0 ? totalIncome / beneficiariesWithIncome.length : 0;

  const layakCount = data.filter((b) => b.status === 'Layak' || b.status === 'Sangat Layak').length;
  const tidakLayakCount = data.filter((b) => b.status === 'Tidak Layak').length;
  const pendingCount = data.filter((b) => !b.status || b.status === 'Pending').length;
  const layakPercentage = total > 0 ? (layakCount / total) * 100 : 0;

  return {
    total,
    averageIncome,
    layakPercentage,
    chartData: [
      {
        name: 'Status Kelayakan',
        Layak: layakCount,
        'Tidak Layak': tidakLayakCount,
        Pending: pendingCount,
      },
    ],
  };
}

export default function Stats({ data }) {
  const [source, setSource] = useState('period');
  const [allResidentsStats, setAllResidentsStats] = useState(null);
  const [allResidentsLoading, setAllResidentsLoading] = useState(false);
  const [allResidentsError, setAllResidentsError] = useState('');

  const periodStats = useMemo(() => computePeriodStats(data), [data]);

  useEffect(() => {
    if (source !== 'all_residents' || allResidentsStats || allResidentsLoading) {
      return;
    }

    const token = localStorage.getItem('token');
    setAllResidentsLoading(true);
    setAllResidentsError('');

    fetch('/api/beneficiaries/statistics?source=all_residents', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (res) => {
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload?.error || 'Gagal memuat statistik seluruh resident');
        }
        return res.json();
      })
      .then((payload) => {
        setAllResidentsStats({
          total: Number(payload?.total) || 0,
          averageIncome: Number(payload?.averageIncome) || 0,
          layakPercentage: Number(payload?.layakPercentage) || 0,
          chartData: Array.isArray(payload?.chartData) && payload.chartData.length > 0 ? payload.chartData : EMPTY_STATS.chartData,
        });
      })
      .catch((error) => {
        setAllResidentsError(error.message || 'Gagal memuat statistik seluruh resident');
      })
      .finally(() => {
        setAllResidentsLoading(false);
      });
  }, [source, allResidentsStats, allResidentsLoading]);

  const activeStats = source === 'all_residents'
    ? (allResidentsStats || EMPTY_STATS)
    : periodStats;

  return (
    <div className="mt-8 md:mt-12">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4 md:mb-6">
        <h2 className="text-xl md:text-2xl font-semibold text-slate-800">Statistik & Grafik</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSource('period')}
            className={`px-3 py-2 text-xs md:text-sm font-medium rounded-md ${source === 'period' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'}`}
          >
            Berdasarkan Periode Ditampilkan
          </button>
          <button
            onClick={() => setSource('all_residents')}
            className={`px-3 py-2 text-xs md:text-sm font-medium rounded-md ${source === 'all_residents' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'}`}
          >
            Berdasarkan Semua penduduk
          </button>
        </div>
      </div>

      {source === 'all_residents' && allResidentsLoading && (
        <div className="mb-4 p-3 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-600">
          Memuat statistik semua penduduk...
        </div>
      )}

      {source === 'all_residents' && allResidentsError && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {allResidentsError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        <StatCard
          title="Total Warga"
          value={activeStats.total}
          description={source === 'period' ? 'Total data penerima bantuan di periode yang ditampilkan' : 'Total seluruh data warga pada tabel penduduk'}
        />
        <StatCard
          title="Rata-rata Penghasilan"
          value={`Rp ${activeStats.averageIncome.toLocaleString('id-ID')}`}
          description={source === 'period' ? 'Rata-rata penghasilan dari data periode yang ditampilkan' : 'Rata-rata penghasilan dari seluruh penduduk'}
        />
        <StatCard
          title="Persentase Layak"
          value={`${activeStats.layakPercentage.toFixed(1)}%`}
          description="Persentase status Layak/Sangat Layak"
        />
      </div>

      <div className="mt-6 md:mt-8 bg-white p-4 md:p-6 rounded-xl border border-slate-200">
        <h3 className="text-sm md:text-base font-semibold text-slate-800 mb-3 md:mb-4">Distribusi Status Kelayakan</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={activeStats.chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="Layak" fill="#10b981" />
            <Bar dataKey="Tidak Layak" fill="#f59e0b" />
            <Bar dataKey="Pending" fill="#94a3b8" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
