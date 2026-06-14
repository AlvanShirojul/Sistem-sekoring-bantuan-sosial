/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ImportExcelModal from './ImportExcelModal';

export default function ResidentsDashboard() {
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [total, setTotal] = useState(0);
  const [showAddCriteria, setShowAddCriteria] = useState(false);
  const [newCriterionKey, setNewCriterionKey] = useState('');
  const [newCriterionLabel, setNewCriterionLabel] = useState('');
  const [isSavingCriterion, setIsSavingCriterion] = useState(false);
  const [criteriaOptions, setCriteriaOptions] = useState([]);

  const sanitizeCriterionKey = (raw) => String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');

  const handleAddCriterion = async () => {
    const key = sanitizeCriterionKey(newCriterionKey);
    const label = String(newCriterionLabel || '').trim();

    if (!key) {
      alert('Key kriteria wajib diisi.');
      return;
    }
    if (!label) {
      alert('Label kriteria wajib diisi.');
      return;
    }

    setIsSavingCriterion(true);
    try {
      const token = localStorage.getItem('token');
      const getResponse = await fetch('/api/beneficiaries/bwm-config', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!getResponse.ok) {
        throw new Error('Gagal memuat konfigurasi BWM.');
      }
      const config = await getResponse.json();
      const currentOptions = Array.isArray(config.criteriaOptions) ? config.criteriaOptions : [];
      if (currentOptions.some((item) => item.key === key)) {
        throw new Error('Key kriteria sudah ada.');
      }

      const nextOptions = [...currentOptions, { key, label, source: 'custom' }];
      const currentActive = Array.isArray(config.activeCriteria) ? config.activeCriteria : [];
      const nextActive = Array.from(new Set([...currentActive, key]));

      const nextBestToOthers = { ...(config.bestToOthers || {}), [key]: 1 };
      const nextOthersToWorst = { ...(config.othersToWorst || {}), [key]: 1 };
      const nextBest = nextActive.includes(config.bestCriterion) ? config.bestCriterion : nextActive[0];
      const nextWorst = nextActive.includes(config.worstCriterion) ? config.worstCriterion : nextActive[nextActive.length - 1];

      const saveResponse = await fetch('/api/beneficiaries/bwm-config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          criteriaOptions: nextOptions,
          activeCriteria: nextActive,
          bestCriterion: nextBest,
          worstCriterion: nextWorst,
          bestToOthers: nextBestToOthers,
          othersToWorst: nextOthersToWorst,
        }),
      });

      if (!saveResponse.ok) {
        const err = await saveResponse.json().catch(() => ({}));
        throw new Error(err.error || 'Gagal menambahkan kriteria baru.');
      }

      alert('Kriteria baru berhasil ditambahkan dan otomatis aktif pada perhitungan BWM.');
      setNewCriterionKey('');
      setNewCriterionLabel('');
      setCriteriaOptions(nextOptions);
      setShowAddCriteria(false);
    } catch (err) {
      alert(err.message || 'Gagal menambahkan kriteria.');
    } finally {
      setIsSavingCriterion(false);
    }
  };

  const fetchCriteriaOptions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/beneficiaries/bwm-config', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) return;
      const data = await response.json();
      setCriteriaOptions(Array.isArray(data.criteriaOptions) ? data.criteriaOptions : []);
    } catch {
      // Keep residents dashboard usable even when criteria config fails to load.
    }
  };

  const handleDeleteCriterion = async (key, label) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus kriteria "${label}"?`)) {
      return;
    }

    setIsSavingCriterion(true);
    try {
      const token = localStorage.getItem('token');
      const getResponse = await fetch('/api/beneficiaries/bwm-config', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!getResponse.ok) {
        throw new Error('Gagal memuat konfigurasi BWM.');
      }

      const config = await getResponse.json();
      const currentOptions = Array.isArray(config.criteriaOptions) ? config.criteriaOptions : [];
      const target = currentOptions.find((item) => item.key === key);
      if (!target || target.source !== 'custom') {
        throw new Error('Kriteria tidak ditemukan atau tidak bisa dihapus.');
      }

      const nextOptions = currentOptions.filter((item) => item.key !== key);
      const currentActive = Array.isArray(config.activeCriteria) ? config.activeCriteria : [];
      const nextActive = currentActive.filter((item) => item !== key);
      if (nextActive.length < 2) {
        throw new Error('Tidak bisa menghapus: minimal 2 kriteria aktif.');
      }

      const nextBestToOthers = { ...(config.bestToOthers || {}) };
      const nextOthersToWorst = { ...(config.othersToWorst || {}) };
      delete nextBestToOthers[key];
      delete nextOthersToWorst[key];

      const nextBest = nextActive.includes(config.bestCriterion) ? config.bestCriterion : nextActive[0];
      const nextWorst = nextActive.includes(config.worstCriterion) ? config.worstCriterion : nextActive[nextActive.length - 1];

      const saveResponse = await fetch('/api/beneficiaries/bwm-config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          criteriaOptions: nextOptions,
          activeCriteria: nextActive,
          bestCriterion: nextBest,
          worstCriterion: nextWorst,
          bestToOthers: nextBestToOthers,
          othersToWorst: nextOthersToWorst,
        }),
      });

      if (!saveResponse.ok) {
        const err = await saveResponse.json().catch(() => ({}));
        throw new Error(err.error || 'Gagal menghapus kriteria.');
      }

      setCriteriaOptions(nextOptions);
      alert('Kriteria berhasil dihapus.');
    } catch (err) {
      alert(err.message || 'Gagal menghapus kriteria.');
    } finally {
      setIsSavingCriterion(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus data penduduk ini? Tindakan ini tidak dapat dibatalkan.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/resident/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Gagal menghapus penduduk.');
      }

      fetchResidents(page, searchTerm);

    } catch (error) {
      console.error('Error deleting resident:', error);
      alert(error.message);
    }
  };

  const fetchResidents = (targetPage = page, targetSearch = searchTerm) => {
    setLoading(true);
    setError('');
    const token = localStorage.getItem('token');
    const params = new URLSearchParams({
      page: String(targetPage),
      limit: String(limit),
    });
    if (targetSearch.trim()) {
      params.set('search', targetSearch.trim());
    }

    fetch(`/api/residents?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => {
        if (!res.ok) {
          throw new Error(`Failed to fetch residents: ${res.statusText}`);
        }
        return res.json();
      })
      .then(data => {
        setResidents(data?.items || []);
        setTotal(data?.total || 0);
        setPage(data?.page || targetPage);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch residents:", err);
        setError(err.message || 'Gagal memuat data penduduk');
        setLoading(false);
      });
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchResidents(1, searchTerm);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchTerm]);

  useEffect(() => {
    fetchCriteriaOptions();
  }, []);

  const handleImportSuccess = () => {
      fetchResidents(page, searchTerm); // Refetch current page after import
  }
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <>
      <ImportExcelModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onImportSuccess={handleImportSuccess}
      />
      <div className="bg-white shadow-md rounded-xl">
      <div className="p-6 border-b border-slate-200 flex justify-between items-center">
        <div>
            <h2 className="text-2xl font-semibold text-slate-800">Data Penduduk</h2>
            <p className="mt-1 text-slate-500">Daftar semua penduduk yang terdata di sistem.</p>
        </div>
        <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowAddCriteria((prev) => !prev)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white rounded-md border border-slate-300 hover:bg-slate-50">
              + Tambah Kriteria
            </button>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white rounded-md border border-slate-300 hover:bg-slate-50">
              Impor Excel
            </button>
            <Link to="/resident/new" className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-500">
                + Tambah Penduduk
            </Link>
        </div>
      </div>
      {showAddCriteria && (
        <div className="mx-6 mt-6 p-4 border border-slate-200 rounded-lg bg-slate-50">
          <p className="text-sm font-semibold text-slate-800">Tambah Kriteria Baru</p>
          <p className="text-xs text-slate-500 mt-1">Kriteria baru otomatis ditambahkan ke daftar aktif BWM.</p>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
            <input
              type="text"
              value={newCriterionKey}
              onChange={(e) => setNewCriterionKey(e.target.value)}
              placeholder="key_kriteria"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={newCriterionLabel}
              onChange={(e) => setNewCriterionLabel(e.target.value)}
              placeholder="Label Kriteria"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={isSavingCriterion}
              onClick={handleAddCriterion}
              className="px-3 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-500 disabled:opacity-50"
            >
              {isSavingCriterion ? 'Menyimpan...' : 'Simpan Kriteria'}
            </button>
          </div>
          <div className="mt-4">
            <p className="text-sm font-semibold text-slate-800">Kriteria Custom Saat Ini</p>
            <div className="mt-2 space-y-2">
              {criteriaOptions.filter((item) => item.source === 'custom').length === 0 ? (
                <p className="text-xs text-slate-500">Belum ada kriteria custom.</p>
              ) : (
                criteriaOptions
                  .filter((item) => item.source === 'custom')
                  .map((item) => (
                    <div key={item.key} className="flex items-center justify-between gap-2 border border-slate-200 rounded-md bg-white px-3 py-2">
                      <div>
                        <p className="text-sm text-slate-800">{item.label}</p>
                        <p className="text-xs text-slate-500">{item.key}</p>
                      </div>
                      <button
                        type="button"
                        disabled={isSavingCriterion}
                        onClick={() => handleDeleteCriterion(item.key, item.label)}
                        className="text-sm font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
                      >
                        Hapus
                      </button>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md mx-6 mt-6 text-red-800">
          <p className="font-semibold">Error: {error}</p>
          <button onClick={fetchResidents} className="mt-2 text-sm font-medium text-red-600 hover:text-red-800 underline">
            Coba Lagi
          </button>
        </div>
      )}
      <div className="px-6 pt-6">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Cari nama, NIK, pekerjaan, atau alamat..."
          className="w-full md:w-96 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left">
          <thead className="bg-slate-50 border-b border-slate-200 text-sm text-slate-600">
            <tr>
              <th className="p-4 font-medium">Nama</th>
              <th className="p-4 font-medium">NIK</th>
              <th className="p-4 font-medium">Skor SAW</th>
              <th className="p-4 font-medium">Pekerjaan</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-500">Memuat data...</td></tr>
            ) : residents.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-500">Tidak ada data penduduk</td></tr>
            ) : residents.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-500">Data penduduk tidak ditemukan</td></tr>
            ) : residents.map((person) => (
              <tr key={person.id} className="border-b border-slate-200 hover:bg-slate-50">
                <td className="p-4 font-medium text-slate-900">{person.name}</td>
                <td className="p-4 text-slate-500">{person.nik}</td>
                <td className="p-4 text-slate-500">{person.saw_score !== null && person.saw_score !== undefined ? Number(person.saw_score).toFixed(2) : '-'}</td>
                <td className="p-4 text-slate-500">{person.occupation}</td>
                <td className="p-4 text-slate-500">{person.marital_status}</td>
                <td className="p-4 space-x-4 whitespace-nowrap">
                  <Link to={`/resident/${person.id}/detail`} className="text-sm font-medium text-blue-600 hover:text-blue-800">Detail</Link>
                  <Link to={`/resident/${person.id}/edit`} className="text-sm font-medium text-indigo-600 hover:text-indigo-800">Edit</Link>
                  <button 
                    onClick={() => handleDelete(person.id)}
                    className="text-sm font-medium text-red-600 hover:text-red-800">
                    Hapus
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!loading && total > 0 && (
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
          <p className="text-sm text-slate-600">
            Menampilkan {(page - 1) * limit + 1} - {Math.min(page * limit, total)} dari {total} data
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchResidents(page - 1, searchTerm)}
              disabled={page <= 1}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-md disabled:opacity-50"
            >
              Sebelumnya
            </button>
            <span className="text-sm text-slate-600">Halaman {page} / {totalPages}</span>
            <button
              type="button"
              onClick={() => fetchResidents(page + 1, searchTerm)}
              disabled={page >= totalPages}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-md disabled:opacity-50"
            >
              Berikutnya
            </button>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
