/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

function asScaleValue(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  const rounded = Math.round(parsed);
  if (rounded < 1) return 1;
  if (rounded > 9) return 9;
  return rounded;
}

export default function EditPeriodPage() {
  const { periodId } = useParams();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [quota, setQuota] = useState('');
  const [recipientCount, setRecipientCount] = useState(0);
  const [acceptedCount, setAcceptedCount] = useState(0);
  const [criteriaOptions, setCriteriaOptions] = useState([]);
  const [activeCriteria, setActiveCriteria] = useState([]);
  const [bestCriterion, setBestCriterion] = useState('');
  const [worstCriterion, setWorstCriterion] = useState('');
  const [bestToOthers, setBestToOthers] = useState({});
  const [othersToWorst, setOthersToWorst] = useState({});
  const [weights, setWeights] = useState({});
  const [isCalculating, setIsCalculating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const scaleOptions = Array.from({ length: 9 }, (_, i) => i + 1);
  const sortedActiveCriteria = criteriaOptions
    .filter((item) => activeCriteria.includes(item.key))
    .map((item) => item.key);

  useEffect(() => {
    if (!periodId) return;

    const token = localStorage.getItem('token');
    fetch(`/api/periods/${periodId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          throw new Error(err?.error || 'Gagal memuat periode');
        }
        return res.json();
      })
      .then((data) => {
        setName(data.name || '');
        setStartDate(data.start_date || '');
        setEndDate(data.end_date || '');
        setQuota(data.quota?.toString() || '');
        setRecipientCount(Number(data.recipient_count || 0));
        setAcceptedCount(Number(data.accepted_count || 0));
        const periodConfig = data.bwm_config;
        if (periodConfig) {
          setCriteriaOptions(periodConfig.criteriaOptions || []);
          setActiveCriteria(periodConfig.activeCriteria || []);
          setBestCriterion(periodConfig.bestCriterion || '');
          setWorstCriterion(periodConfig.worstCriterion || '');
          setBestToOthers(periodConfig.bestToOthers || {});
          setOthersToWorst(periodConfig.othersToWorst || {});
          setWeights(periodConfig.weights || {});
        } else {
          const loadDefault = async () => {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/beneficiaries/bwm-config', {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) return;
            const fallback = await response.json();
            setCriteriaOptions(fallback.criteriaOptions || []);
            setActiveCriteria(fallback.activeCriteria || []);
            setBestCriterion(fallback.bestCriterion || '');
            setWorstCriterion(fallback.worstCriterion || '');
            setBestToOthers(fallback.bestToOthers || {});
            setOthersToWorst(fallback.othersToWorst || {});
            setWeights(fallback.weights || {});
          };
          loadDefault().catch(() => null);
        }
      })
      .catch((err) => {
        alert(err.message || 'Gagal memuat periode');
        navigate('/');
      })
      .finally(() => setIsLoading(false));
  }, [periodId, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!periodId) return;

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/periods/${periodId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          start_date: startDate,
          end_date: endDate,
          quota: quota ? parseInt(quota) : null,
          bwm_config: sortedActiveCriteria.length >= 2 ? {
            criteriaOptions,
            activeCriteria: sortedActiveCriteria,
            bestCriterion,
            worstCriterion,
            bestToOthers: sortedActiveCriteria.reduce((acc, key) => {
              acc[key] = key === bestCriterion ? 1 : asScaleValue(bestToOthers[key] ?? 1);
              return acc;
            }, {}),
            othersToWorst: sortedActiveCriteria.reduce((acc, key) => {
              acc[key] = key === worstCriterion ? 1 : asScaleValue(othersToWorst[key] ?? 1);
              return acc;
            }, {}),
          } : null
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || 'Gagal memperbarui periode');
      }

      const data = await response.json();
      alert(`Periode berhasil diperbarui. ${data.auto_generated_beneficiaries || 0} penerima disesuaikan otomatis berdasarkan kuota dan ranking.`);
      setRecipientCount(Number(data.auto_generated_beneficiaries || 0));
      navigate('/');
    } catch (error) {
      alert(`Gagal memperbarui periode: ${error.message}`);
      setIsSubmitting(false);
    }
  };

  const handleCalculateBwm = async () => {
    if (sortedActiveCriteria.length < 2) {
      alert('Minimal 2 kriteria aktif.');
      return;
    }
    setIsCalculating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/beneficiaries/bwm-config/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          criteriaOptions,
          activeCriteria: sortedActiveCriteria,
          bestCriterion,
          worstCriterion,
          bestToOthers: sortedActiveCriteria.reduce((acc, key) => {
            acc[key] = key === bestCriterion ? 1 : asScaleValue(bestToOthers[key] ?? 1);
            return acc;
          }, {}),
          othersToWorst: sortedActiveCriteria.reduce((acc, key) => {
            acc[key] = key === worstCriterion ? 1 : asScaleValue(othersToWorst[key] ?? 1);
            return acc;
          }, {}),
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Gagal menghitung BWM');
      }
      const data = await response.json();
      setWeights(data.weights || {});
      alert('Perhitungan BWM selesai.');
    } catch (error) {
      alert(error.message || 'Gagal menghitung BWM');
    } finally {
      setIsCalculating(false);
    }
  };

  const handleDelete = async () => {
    if (!periodId || isDeleting) return;

    const confirmed = window.confirm(
      'Hapus periode ini? Semua data penerima pada periode ini juga akan dihapus.'
    );

    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/periods/${periodId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || 'Gagal menghapus periode');
      }

      const data = await response.json();
      alert(`Periode berhasil dihapus. ${data.deleted_beneficiaries || 0} data penerima ikut dihapus.`);
      navigate('/');
    } catch (error) {
      alert(`Gagal menghapus periode: ${error.message}`);
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return <div className="text-center p-12">Memuat periode...</div>;
  }

  return (
    <div className="bg-white shadow-md rounded-xl max-w-2xl mx-auto">
      <div className="p-6 border-b border-slate-200">
        <h2 className="text-2xl font-semibold text-slate-800">Edit Periode Bantuan</h2>
      </div>
      <form onSubmit={handleSubmit} className="p-6">
        <div className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-slate-700">Nama Periode</label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border-slate-300 shadow-sm"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="start-date" className="block text-sm font-medium text-slate-700">Tanggal Mulai</label>
              <input
                type="date"
                id="start-date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="mt-1 block w-full rounded-md border-slate-300 shadow-sm"
              />
            </div>
            <div>
              <label htmlFor="end-date" className="block text-sm font-medium text-slate-700">Tanggal Selesai</label>
              <input
                type="date"
                id="end-date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="mt-1 block w-full rounded-md border-slate-300 shadow-sm"
              />
            </div>
          </div>
          <div>
            <label htmlFor="quota" className="block text-sm font-medium text-slate-700">Jumlah Penerima Maksimal (Opsional)</label>
            <input
              type="number"
              id="quota"
              value={quota}
              onChange={(e) => setQuota(e.target.value)}
              min="1"
              className="mt-1 block w-full rounded-md border-slate-300 shadow-sm"
            />
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <p className="text-xs text-blue-900">Jumlah penduduk menerima (Layak/Sangat Layak): <span className="font-bold">{acceptedCount}</span></p>
            <p className="text-xs text-blue-800 mt-1">Total data penerima di periode ini: <span className="font-bold">{recipientCount}</span></p>
          </div>

          <div className="border border-slate-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-slate-800">Pengaturan BWM Periode</h3>
            <p className="text-xs text-slate-500 mt-1">Bobot ini hanya berlaku untuk periode ini.</p>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Kriteria Terbaik</label>
                <select value={bestCriterion} onChange={(e) => setBestCriterion(e.target.value)} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm">
                  {sortedActiveCriteria.map((key) => {
                    const label = criteriaOptions.find((item) => item.key === key)?.label || key;
                    return <option key={key} value={key}>{label}</option>;
                  })}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Kriteria Terburuk</label>
                <select value={worstCriterion} onChange={(e) => setWorstCriterion(e.target.value)} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm">
                  {sortedActiveCriteria.map((key) => {
                    const label = criteriaOptions.find((item) => item.key === key)?.label || key;
                    return <option key={key} value={key}>{label}</option>;
                  })}
                </select>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-700">Best to Others</p>
                {sortedActiveCriteria.map((key) => {
                  const label = criteriaOptions.find((item) => item.key === key)?.label || key;
                  const disabled = key === bestCriterion;
                  return (
                    <div key={key} className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-600">{label}</span>
                      <select
                        disabled={disabled}
                        value={disabled ? 1 : asScaleValue(bestToOthers[key] ?? 1)}
                        onChange={(e) => setBestToOthers((prev) => ({ ...prev, [key]: asScaleValue(e.target.value) }))}
                        className="w-20 rounded-md border-slate-300 shadow-sm disabled:bg-slate-100"
                      >
                        {scaleOptions.map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                  );
                })}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-700">Others to Worst</p>
                {sortedActiveCriteria.map((key) => {
                  const label = criteriaOptions.find((item) => item.key === key)?.label || key;
                  const disabled = key === worstCriterion;
                  return (
                    <div key={key} className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-600">{label}</span>
                      <select
                        disabled={disabled}
                        value={disabled ? 1 : asScaleValue(othersToWorst[key] ?? 1)}
                        onChange={(e) => setOthersToWorst((prev) => ({ ...prev, [key]: asScaleValue(e.target.value) }))}
                        className="w-20 rounded-md border-slate-300 shadow-sm disabled:bg-slate-100"
                      >
                        {scaleOptions.map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-3">
              <button
                type="button"
                onClick={handleCalculateBwm}
                disabled={isCalculating || isSubmitting || isDeleting}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-700 rounded-md hover:bg-slate-600 disabled:opacity-50"
              >
                {isCalculating ? 'Menghitung...' : 'Hitung BWM'}
              </button>
            </div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
              {sortedActiveCriteria.map((key) => {
                const label = criteriaOptions.find((item) => item.key === key)?.label || key;
                const weight = Number(weights[key] || 0);
                return (
                  <div key={key} className="text-xs text-slate-700 flex justify-between border border-slate-200 rounded-md px-2 py-1.5">
                    <span>{label}</span>
                    <strong>{weight.toFixed(4)}</strong>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-slate-200 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting || isSubmitting}
              className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-md shadow-sm hover:bg-red-500 disabled:opacity-50"
            >
              {isDeleting ? 'Menghapus...' : 'Hapus Periode'}
            </button>
            <button type="button" onClick={() => navigate(-1)} className="text-sm font-medium text-slate-600 hover:text-slate-800">
              Batal
            </button>
          </div>
          <button
            type="submit"
            disabled={isSubmitting || isDeleting}
            className="px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-500 disabled:opacity-50"
          >
            {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </form>
    </div>
  );
}
