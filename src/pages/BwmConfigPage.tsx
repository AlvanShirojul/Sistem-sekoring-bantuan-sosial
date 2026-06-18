import { useEffect, useMemo, useState } from 'react';

interface CriteriaOption {
  key: string;
  label: string;
  source?: 'builtin' | 'custom';
  parentKey?: string; // For sub-criteria
  subCriteria?: CriteriaOption[];
}

interface BwmConfigResponse {
  activeCriteria: string[];
  criteriaOptions: CriteriaOption[];
  bestCriterion: string;
  worstCriterion: string;
  bestToOthers: Record<string, number>;
  othersToWorst: Record<string, number>;
  weights: Record<string, number>;
}

interface SawHistoryRun {
  run_id: number;
  reason: string;
  created_at: string;
  resident_count: number;
}

function asScaleValue(value: string | number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  const rounded = Math.round(parsed);
  if (rounded < 1) return 1;
  if (rounded > 9) return 9;
  return rounded;
}

export default function BwmConfigPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [criteriaOptions, setCriteriaOptions] = useState<CriteriaOption[]>([]);
  const [activeCriteria, setActiveCriteria] = useState<string[]>([]);
  const [bestCriterion, setBestCriterion] = useState('');
  const [worstCriterion, setWorstCriterion] = useState('');
  const [bestToOthers, setBestToOthers] = useState<Record<string, number>>({});
  const [othersToWorst, setOthersToWorst] = useState<Record<string, number>>({});
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [historyRuns, setHistoryRuns] = useState<SawHistoryRun[]>([]);
  const [hasPreview, setHasPreview] = useState(false);
  const [newCriterionKey, setNewCriterionKey] = useState('');
  const [newCriterionLabel, setNewCriterionLabel] = useState('');
  const [newCriterionParent, setNewCriterionParent] = useState('');
  const scaleOptions = useMemo(() => Array.from({ length: 9 }, (_, i) => i + 1), []);

  const sortedActiveCriteria = useMemo(() => {
    const activeSet = new Set(activeCriteria);
    return criteriaOptions
      .filter((item) => activeSet.has(item.key) && !item.parentKey && !String(item.key).includes('.'))
      .map((item) => item.key);
  }, [criteriaOptions, activeCriteria]);

  // Only show these main criteria in the BWM calculation section
  const BWM_VISIBLE_KEYS = ['income', 'house', 'family', 'employment'];
  const calcCriteria = useMemo(() => {
    return sortedActiveCriteria.filter((k) => BWM_VISIBLE_KEYS.includes(k));
  }, [sortedActiveCriteria]);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/beneficiaries/bwm-config', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Gagal memuat konfigurasi BWM');
      }

      const data: BwmConfigResponse = await response.json();
      setCriteriaOptions(data.criteriaOptions || []);
      // Debug: show criteriaOptions in browser console to inspect parentKey/dot notation
      try {
        // eslint-disable-next-line no-console
        console.log('BWM criteriaOptions:', data.criteriaOptions);
      } catch (e) {
        // ignore
      }
      setActiveCriteria(data.activeCriteria || []);
      setBestCriterion(data.bestCriterion || '');
      setWorstCriterion(data.worstCriterion || '');
      setBestToOthers(
        Object.entries(data.bestToOthers || {}).reduce((acc, [key, value]) => {
          acc[key] = asScaleValue(value);
          return acc;
        }, {} as Record<string, number>)
      );
      setOthersToWorst(
        Object.entries(data.othersToWorst || {}).reduce((acc, [key, value]) => {
          acc[key] = asScaleValue(value);
          return acc;
        }, {} as Record<string, number>)
      );
      setWeights(data.weights || {});
    } catch (error: any) {
      alert(error.message || 'Gagal memuat konfigurasi BWM');
    } finally {
      setLoading(false);
    }
  };

  const fetchSawHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/beneficiaries/saw-history?limit=10', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) return;
      const data = await response.json();
      setHistoryRuns(Array.isArray(data) ? data : []);
    } catch {
      // Keep UI functional even when history endpoint fails.
    }
  };

  useEffect(() => {
    fetchConfig();
    fetchSawHistory();
  }, []);

  const buildPayload = () => ({
    criteriaOptions,
    activeCriteria: sortedActiveCriteria,
    bestCriterion,
    worstCriterion,
    bestToOthers: sortedActiveCriteria.reduce((acc, key) => {
      acc[key] = key === bestCriterion ? 1 : asScaleValue(bestToOthers[key] ?? 1);
      return acc;
    }, {} as Record<string, number>),
    othersToWorst: sortedActiveCriteria.reduce((acc, key) => {
      acc[key] = key === worstCriterion ? 1 : asScaleValue(othersToWorst[key] ?? 1);
      return acc;
    }, {} as Record<string, number>),
  });

  const toggleCriterion = (key: string) => {
    const next = activeCriteria.includes(key)
      ? activeCriteria.filter((item) => item !== key)
      : [...activeCriteria, key];

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

  const addCriterion = () => {
    const key = String(newCriterionKey || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');
    const label = String(newCriterionLabel || '').trim();
    const parentKey = String(newCriterionParent || '').trim();

    if (!key) {
      alert('Key kriteria wajib diisi.');
      return;
    }
    if (!label) {
      alert('Label kriteria wajib diisi.');
      return;
    }
    if (criteriaOptions.some((item) => item.key === key)) {
      alert('Key kriteria sudah ada.');
      return;
    }

    const newCriterion: CriteriaOption = {
      key,
      label,
      source: 'custom' as const,
      parentKey: parentKey || undefined,
    };

    const nextOptions = [...criteriaOptions, newCriterion];
    const nextActive = [...activeCriteria, key];
    setCriteriaOptions(nextOptions);
    setActiveCriteria(nextActive);
    setBestToOthers((prev) => ({ ...prev, [key]: 1 }));
    setOthersToWorst((prev) => ({ ...prev, [key]: 1 }));
    setWeights((prev) => ({ ...prev, [key]: 0 }));
    setNewCriterionKey('');
    setNewCriterionLabel('');
    setNewCriterionParent('');
  };

  const removeCustomCriterion = (key: string) => {
    const target = criteriaOptions.find((item) => item.key === key);
    if (!target || target.source === 'builtin') {
      return;
    }
    if (!window.confirm(`Hapus kriteria "${target.label}"? Perubahan ini akan diterapkan setelah Anda klik Simpan Konfigurasi BWM.`)) {
      return;
    }

    const nextOptions = criteriaOptions.filter((item) => item.key !== key);
    const nextActive = activeCriteria.filter((item) => item !== key);
    if (nextActive.length < 2) {
      alert('Tidak bisa menghapus: minimal 2 kriteria aktif.');
      return;
    }

    setCriteriaOptions(nextOptions);
    setActiveCriteria(nextActive);
    setBestToOthers((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
    setOthersToWorst((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
    setWeights((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });

    if (bestCriterion === key) setBestCriterion(nextActive[0]);
    if (worstCriterion === key) setWorstCriterion(nextActive[nextActive.length - 1]);
  };

  const handleSave = async (e: any) => {
    e.preventDefault();

    if (activeCriteria.length < 2) {
      alert('Minimal 2 kriteria aktif.');
      return;
    }

    if (!activeCriteria.includes(bestCriterion) || !activeCriteria.includes(worstCriterion)) {
      alert('Kriteria terbaik/terburuk harus termasuk kriteria aktif.');
      return;
    }

    const payload = buildPayload();

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Token tidak ditemukan. Silakan login ulang.');
        setSaving(false);
        return;
      }

      const response = await fetch('/api/beneficiaries/bwm-config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        // Log response body for debugging (may be JSON or text)
        let errBody = null;
        try {
          errBody = await response.json();
        } catch (e) {
          try { errBody = await response.text(); } catch { errBody = '<unreadable>'; }
        }
        // eslint-disable-next-line no-console
        console.error('Failed to save BWM config:', response.status, errBody);
        const errMsg = (errBody && errBody.error) ? errBody.error : `Gagal menyimpan konfigurasi BWM (status ${response.status})`;
        throw new Error(errMsg);
      }

      const data: BwmConfigResponse = await response.json();
      setActiveCriteria(data.activeCriteria || []);
      setBestCriterion(data.bestCriterion || '');
      setWorstCriterion(data.worstCriterion || '');
      setBestToOthers(
        Object.entries(data.bestToOthers || {}).reduce((acc, [key, value]) => {
          acc[key] = asScaleValue(value);
          return acc;
        }, {} as Record<string, number>)
      );
      setOthersToWorst(
        Object.entries(data.othersToWorst || {}).reduce((acc, [key, value]) => {
          acc[key] = asScaleValue(value);
          return acc;
        }, {} as Record<string, number>)
      );
      setWeights(data.weights || {});
      setHasPreview(false);
      await fetchSawHistory();
      alert('Konfigurasi BWM tersimpan dan skor SAW berhasil dihitung ulang.');
    } catch (error: any) {
      alert(error.message || 'Gagal menyimpan konfigurasi BWM');
    } finally {
      setSaving(false);
    }
  };

  const handleCalculateBwm = async () => {
    if (activeCriteria.length < 2) {
      alert('Minimal 2 kriteria aktif.');
      return;
    }
    if (!activeCriteria.includes(bestCriterion) || !activeCriteria.includes(worstCriterion)) {
      alert('Kriteria terbaik/terburuk harus termasuk kriteria aktif.');
      return;
    }

    setCalculating(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Token tidak ditemukan. Silakan login ulang.');
        setCalculating(false);
        return;
      }

      const response = await fetch('/api/beneficiaries/bwm-config/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(buildPayload()),
      });

      if (!response.ok) {
        let errBody = null;
        try {
          errBody = await response.json();
        } catch (e) {
          try { errBody = await response.text(); } catch { errBody = '<unreadable>'; }
        }
        // eslint-disable-next-line no-console
        console.error('Failed to calculate BWM preview:', response.status, errBody);
        const errMsg = (errBody && errBody.error) ? errBody.error : `Gagal menghitung BWM (status ${response.status})`;
        throw new Error(errMsg);
      }

      const data: BwmConfigResponse = await response.json();
      setWeights(data.weights || {});
      setBestToOthers(
        Object.entries(data.bestToOthers || {}).reduce((acc, [key, value]) => {
          acc[key] = asScaleValue(value);
          return acc;
        }, {} as Record<string, number>)
      );
      setOthersToWorst(
        Object.entries(data.othersToWorst || {}).reduce((acc, [key, value]) => {
          acc[key] = asScaleValue(value);
          return acc;
        }, {} as Record<string, number>)
      );
      setHasPreview(true);
      alert('Perhitungan BWM selesai. Bobot sudah diperbarui sebagai pratinjau.');
    } catch (error: any) {
      alert(error.message || 'Gagal menghitung BWM');
    } finally {
      setCalculating(false);
    }
  };

  if (loading) {
    return <div className="bg-white rounded-xl shadow-md p-6">Memuat konfigurasi BWM...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-2xl font-semibold text-slate-800">Pengaturan BWM (Best-Worst Method)</h2>
        <p className="mt-1 text-slate-500">
          Pilih kriteria aktif (jumlah fleksibel), lalu isi nilai perbandingan BWM untuk menghasilkan bobot SAW otomatis.
        </p>
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-xl shadow-md p-6 space-y-6">
        <div>
          <h3 className="text-base font-semibold text-slate-700">1. Kriteria Aktif</h3>
          <div className="mt-3 p-3 border border-slate-200 rounded-lg bg-slate-50">
            <p className="text-sm font-medium text-slate-700">Tambah Kriteria Baru</p>
            <div className="mt-2 grid grid-cols-1 md:grid-cols-4 gap-2">
              <input
                type="text"
                placeholder="key_kriteria"
                value={newCriterionKey}
                onChange={(e) => setNewCriterionKey(e.target.value)}
                className="rounded-md border-slate-300"
              />
              <input
                type="text"
                placeholder="Label Kriteria"
                value={newCriterionLabel}
                onChange={(e) => setNewCriterionLabel(e.target.value)}
                className="rounded-md border-slate-300"
              />
              <select
                value={newCriterionParent}
                onChange={(e) => setNewCriterionParent(e.target.value)}
                className="rounded-md border-slate-300"
              >
                <option value="">Kriteria Utama</option>
                {criteriaOptions.filter(item => !item.parentKey && !String(item.key).includes('.')).map((item) => (
                  <option key={item.key} value={item.key}>
                    Sub dari: {item.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={addCriterion}
                className="px-3 py-2 text-sm font-semibold text-white bg-slate-700 rounded-md hover:bg-slate-600"
              >
                Tambah
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">Nilai skor kriteria custom dibaca dari `criteria_scores[key]` per penduduk.</p>
          </div>
          <div className="mt-3 space-y-2">
                {criteriaOptions
              .filter(item => !item.parentKey && !String(item.key).includes('.'))
              .map((item) => {
                const checked = activeCriteria.includes(item.key);
                // Sub-criteria are hidden in the UI; backend still uses them for scoring.
                return (
                  <div key={item.key} className="border border-slate-200 rounded-lg p-3">
                    <div className="flex items-center justify-between gap-3">
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCriterion(item.key)}
                          className="h-4 w-4"
                        />
                        <span className="text-sm font-medium text-slate-700">{item.label}</span>
                      </label>
                      {item.source === 'custom' && (
                        <button
                          type="button"
                          onClick={() => removeCustomCriterion(item.key)}
                          className="text-xs text-red-600 hover:text-red-700"
                        >
                          Hapus
                        </button>
                      )}
                    </div>
                    {/* sub-criteria intentionally hidden */}
                  </div>
                );
              })}
          </div>
          <p className="mt-2 text-xs text-slate-500">Minimal 2 kriteria aktif.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">2. Kriteria Terbaik (Best)</label>
            <select
              value={bestCriterion}
              onChange={(e) => setBestCriterion(e.target.value)}
              className="mt-1 w-full rounded-md border-slate-300"
            >
              {calcCriteria.map((key) => {
                const label = criteriaOptions.find((item) => item.key === key)?.label || key;
                return (
                  <option key={key} value={key}>
                    {label}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">3. Kriteria Terburuk (Worst)</label>
            <select
              value={worstCriterion}
              onChange={(e) => setWorstCriterion(e.target.value)}
              className="mt-1 w-full rounded-md border-slate-300"
            >
              {calcCriteria.map((key) => {
                const label = criteriaOptions.find((item) => item.key === key)?.label || key;
                return (
                  <option key={key} value={key}>
                    {label}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-base font-semibold text-slate-700">4. Best to Others (aBj)</h3>
            <p className="text-xs text-slate-500 mb-3">Seberapa lebih penting kriteria terbaik dibanding kriteria lain.</p>
            <div className="space-y-2">
              {calcCriteria.map((key) => {
                const label = criteriaOptions.find((item) => item.key === key)?.label || key;
                const disabled = key === bestCriterion;
                return (
                  <div key={key} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-700">{label}</span>
                    <select
                      disabled={disabled}
                      value={disabled ? 1 : asScaleValue(bestToOthers[key] ?? 1)}
                      onChange={(e) => {
                        const value = asScaleValue(e.target.value);
                        setBestToOthers((prev) => ({ ...prev, [key]: value }));
                      }}
                      className="w-28 rounded-md border-slate-300 disabled:bg-slate-100"
                    >
                      {scaleOptions.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="text-base font-semibold text-slate-700">5. Others to Worst (ajW)</h3>
            <p className="text-xs text-slate-500 mb-3">Seberapa lebih penting tiap kriteria dibanding kriteria terburuk.</p>
            <div className="space-y-2">
              {calcCriteria.map((key) => {
                const label = criteriaOptions.find((item) => item.key === key)?.label || key;
                const disabled = key === worstCriterion;
                return (
                  <div key={key} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-700">{label}</span>
                    <select
                      disabled={disabled}
                      value={disabled ? 1 : asScaleValue(othersToWorst[key] ?? 1)}
                      onChange={(e) => {
                        const value = asScaleValue(e.target.value);
                        setOthersToWorst((prev) => ({ ...prev, [key]: value }));
                      }}
                      className="w-28 rounded-md border-slate-300 disabled:bg-slate-100"
                    >
                      {scaleOptions.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 pt-5">
          <h3 className="text-base font-semibold text-slate-700">Bobot Hasil Saat Ini</h3>
          {hasPreview && (
            <p className="mt-1 text-xs text-amber-700">
              Ini hasil pratinjau dari tombol Hitung BWM. Klik Simpan untuk menerapkan bobot ke perhitungan SAW.
            </p>
          )}
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
            {calcCriteria.map((key) => {
              const label = criteriaOptions.find((item) => item.key === key)?.label || key;
              const weight = Number(weights[key] || 0);
              return (
                <div key={key} className="text-sm text-slate-700 flex justify-between border border-slate-200 rounded-md px-3 py-2">
                  <span>{label}</span>
                  <strong>{weight.toFixed(4)}</strong>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={handleCalculateBwm}
            disabled={calculating || saving}
            className="px-6 py-2.5 mr-2 text-sm font-semibold text-white bg-slate-700 rounded-md shadow-sm hover:bg-slate-600 disabled:opacity-50"
          >
            {calculating ? 'Menghitung...' : 'Hitung BWM'}
          </button>
          <button
            type="submit"
            disabled={saving || calculating}
            className="px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-500 disabled:opacity-50"
          >
            {saving ? 'Menyimpan...' : 'Simpan Konfigurasi BWM'}
          </button>
        </div>
      </form>

      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-base font-semibold text-slate-700">Riwayat Snapshot SAW</h3>
        <p className="mt-1 text-xs text-slate-500">
          Snapshot disimpan otomatis sebelum perubahan bobot BWM diterapkan.
        </p>
        <div className="mt-3 space-y-2">
          {historyRuns.length === 0 ? (
            <p className="text-sm text-slate-500">Belum ada riwayat.</p>
          ) : (
            historyRuns.map((run) => (
              <div key={run.run_id} className="text-sm text-slate-700 flex justify-between border border-slate-200 rounded-md px-3 py-2">
                <span>Run #{run.run_id} · {run.reason}</span>
                <span>{new Date(run.created_at).toLocaleString('id-ID')} · {run.resident_count} data</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
