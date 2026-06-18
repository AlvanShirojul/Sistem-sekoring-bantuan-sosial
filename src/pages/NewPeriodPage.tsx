/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

function asScaleValue(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  const rounded = Math.round(parsed);
  if (rounded < 1) return 1;
  if (rounded > 9) return 9;
  return rounded;
}

export default function NewPeriodPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [quota, setQuota] = useState('');
  const [criteriaOptions, setCriteriaOptions] = useState([]);
  const [activeCriteria, setActiveCriteria] = useState([]);
  const [bestCriterion, setBestCriterion] = useState('');
  const [worstCriterion, setWorstCriterion] = useState('');
  const [bestToOthers, setBestToOthers] = useState({});
  const [othersToWorst, setOthersToWorst] = useState({});
  const [weights, setWeights] = useState({});
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scaleOptions = Array.from({ length: 9 }, (_, i) => i + 1);

  const sortedActiveCriteria = criteriaOptions
    .filter((item) => activeCriteria.includes(item.key) && !String(item.key).includes('.'))
    .map((item) => item.key);

  const toggleActiveCriterion = (key) => {
    const exists = activeCriteria.includes(key);
    const next = exists ? activeCriteria.filter((item) => item !== key) : [...activeCriteria, key];

    if (next.length < 2) {
      alert('Minimal 2 kriteria aktif.');
      return;
    }

    setActiveCriteria(next);
    if (!next.includes(bestCriterion)) {
      setBestCriterion(next[0]);
    }
    if (!next.includes(worstCriterion)) {
      setWorstCriterion(next[next.length - 1]);
    }
  };

  useEffect(() => {
    const loadDefaultBwm = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/beneficiaries/bwm-config', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (!response.ok) return;
        const data = await response.json();
        setCriteriaOptions(data.criteriaOptions || []);
        setActiveCriteria(data.activeCriteria || []);
        setBestCriterion(data.bestCriterion || '');
        setWorstCriterion(data.worstCriterion || '');
        setBestToOthers(data.bestToOthers || {});
        setOthersToWorst(data.othersToWorst || {});
        setWeights(data.weights || {});
      } catch {
        // fallback to empty config in UI
      }
    };
    loadDefaultBwm();
  }, []);

  useEffect(() => {
    const keys = sortedActiveCriteria;
    setBestToOthers((prev) => {
      const next = {};
      keys.forEach((key) => {
        next[key] = key === bestCriterion ? 1 : asScaleValue(prev[key] ?? 1);
      });
      return next;
    });
    setOthersToWorst((prev) => {
      const next = {};
      keys.forEach((key) => {
        next[key] = key === worstCriterion ? 1 : asScaleValue(prev[key] ?? 1);
      });
      return next;
    });
  }, [activeCriteria, bestCriterion, worstCriterion]);

  const buildBwmPayload = () => {
    // Validasi: bestCriterion dan worstCriterion HARUS ada di sortedActiveCriteria
    // Jika tidak, fallback ke kriteria pertama/terakhir
    const validBest = sortedActiveCriteria.includes(bestCriterion)
      ? bestCriterion
      : sortedActiveCriteria[0] || '';

    const validWorst = sortedActiveCriteria.includes(worstCriterion)
      ? worstCriterion
      : sortedActiveCriteria[sortedActiveCriteria.length - 1] || '';

    return {
      criteriaOptions,
      activeCriteria: sortedActiveCriteria,
      criteria: sortedActiveCriteria, // ← Untuk Python BWM solver
      bestCriterion: validBest,
      worstCriterion: validWorst,
      bestToOthers: sortedActiveCriteria.reduce((acc, key) => {
        acc[key] = key === validBest ? 1 : asScaleValue(bestToOthers[key] ?? 1);
        return acc;
      }, {}),
      othersToWorst: sortedActiveCriteria.reduce((acc, key) => {
        acc[key] = key === validWorst ? 1 : asScaleValue(othersToWorst[key] ?? 1);
        return acc;
      }, {}),
    };
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
        body: JSON.stringify(buildBwmPayload()),
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!quota || parseInt(quota) <= 0) {
      alert('Quota wajib diisi dan harus lebih dari 0.');
      return;
    }
    if (sortedActiveCriteria.length < 2) {
      alert('Minimal 2 kriteria aktif untuk menghitung BWM periode.');
      return;
    }

    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/periods', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          start_date: startDate,
          end_date: endDate,
          quota: parseInt(quota),
          bwm_config: buildBwmPayload(),
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to create period';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // If response is not JSON, use status text
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      alert(`Periode berhasil dibuat. ${data.auto_generated_beneficiaries || 0} penerima otomatis ditambahkan sesuai kuota.`);
      navigate('/'); // Redirect to dashboard on success
    } catch (error) {
      console.error('Error creating period:', error);
      alert(`Gagal membuat periode baru: ${error.message}`);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white shadow-md rounded-xl max-w-2xl mx-auto">
      <div className="p-6 border-b border-slate-200">
        <h2 className="text-2xl font-semibold text-slate-800">Buat Periode Bantuan Baru</h2>
        <p className="mt-1 text-slate-500">Isi detail di bawah untuk memulai periode bantuan baru.</p>
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
              className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              placeholder="Contoh: Bantuan Pangan Maret 2026"
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
                className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
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
                className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
          </div>
          <div>
            <label htmlFor="quota" className="block text-sm font-medium text-slate-700">Jumlah Penerima Maksimal</label>
            <input
              type="number"
              id="quota"
              value={quota}
              onChange={(e) => setQuota(e.target.value)}
              min="1"
              required
              className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              placeholder="Contoh: 50 (mengatur batas maksimal orang yang bisa dinyatakan Layak)"
            />
            <p className="mt-1 text-xs text-slate-500">Sistem akan otomatis mengisi penerima bansos berdasarkan ranking skor tertinggi sesuai kuota ini.</p>
          </div>

          <div className="border border-slate-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-slate-800">Pengaturan BWM Periode</h3>
            <p className="text-xs text-slate-500 mt-1">Bobot ini hanya berlaku untuk periode yang sedang dibuat.</p>
            <div className="mt-3">
              <p className="text-xs font-medium text-slate-700">Kriteria Aktif</p>
              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                {criteriaOptions
                  .filter((item) => !String(item.key).includes('.'))
                  .map((item) => {
                    const checked = activeCriteria.includes(item.key);
                    return (
                      <label key={item.key} className="flex items-center gap-2 rounded border border-slate-200 px-2 py-1.5 text-xs text-slate-700">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleActiveCriterion(item.key)}
                          className="h-3.5 w-3.5"
                        />
                        <span>{item.label}</span>
                      </label>
                    );
                  })}
              </div>
            </div>
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
                disabled={isCalculating || isSubmitting}
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
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-sm font-medium text-slate-600 hover:text-slate-800">
            Batal
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50">
            {isSubmitting ? 'Menyimpan...' : 'Simpan Periode'}
          </button>
        </div>
      </form>
    </div>
  );
}
