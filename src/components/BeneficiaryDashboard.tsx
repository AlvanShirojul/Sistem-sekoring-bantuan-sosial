/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { exportBeneficiariesToExcel } from '../utils/excelUtils';

export default function BeneficiaryDashboard({ onBeneficiariesUpdate }) {
  const [allBeneficiaries, setAllBeneficiaries] = useState([]);
  const [filteredBeneficiaries, setFilteredBeneficiaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Semua');
  const [periods, setPeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [selectedPeriodData, setSelectedPeriodData] = useState(null);

  const mapBeneficiaryData = (beneficiary) => ({
    id: beneficiary.id,
    resident_id: beneficiary.resident_id,
    name: beneficiary.name,
    nik: beneficiary.nik,
    score: beneficiary.score !== null && beneficiary.score !== undefined ? Number(beneficiary.score) : null,
    status: beneficiary.status || 'Pending',
    rank: beneficiary.rank,
    income: beneficiary.income ?? null,
    dependents: beneficiary.dependents ?? null,
    house_status: beneficiary.house_status || '-',
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/periods', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then((res) => {
        if (!res.ok) throw new Error('Gagal memuat periode');
        return res.json();
      })
      .then((data) => {
        setPeriods(data || []);
        if (data && data.length > 0) {
          setSelectedPeriod(data[0].id);
          setSelectedPeriodData(data[0]);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch periods:', err);
        setError('Gagal memuat data periode: ' + err.message);
      });
  }, []);

  useEffect(() => {
    if (!selectedPeriod) return;

    setLoading(true);
    setError('');
    const token = localStorage.getItem('token');

    const periodData = periods.find((p) => p.id === selectedPeriod);
    setSelectedPeriodData(periodData);

    fetch(`/api/beneficiaries?periodId=${selectedPeriod}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then((res) => {
        if (!res.ok) throw new Error('Gagal memuat data penduduk');
        return res.json();
      })
      .then((beneficiaries) => {
        const mappedBeneficiaries = (beneficiaries || [])
          .map(mapBeneficiaryData)
          .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
        const nonPendingBeneficiaries = mappedBeneficiaries.filter((b) => b.status !== 'Pending');

        setAllBeneficiaries(nonPendingBeneficiaries);
        setFilteredBeneficiaries(nonPendingBeneficiaries);
        if (onBeneficiariesUpdate) {
          onBeneficiariesUpdate(nonPendingBeneficiaries, selectedPeriod);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch residents:', err);
        setError('Gagal memuat data penerima bansos: ' + err.message);
        setLoading(false);
      });
  }, [selectedPeriod, periods]);

  useEffect(() => {
    let result = allBeneficiaries;

    if (statusFilter !== 'Semua') {
      result = result.filter((b) => b.status === statusFilter);
    }

    if (searchTerm) {
      result = result.filter((b) =>
        b.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredBeneficiaries(result);
  }, [searchTerm, statusFilter, allBeneficiaries]);

  const handleExport = () => {
    exportBeneficiariesToExcel(filteredBeneficiaries, selectedPeriod);
  };

  const handlePeriodChange = (e) => {
    setSelectedPeriod(Number(e.target.value));
  };

  const actionButtonBaseClasses = 'shrink-0 inline-flex items-center justify-center gap-1.5 px-2.5 md:px-3 py-2 text-xs md:text-sm font-medium rounded-md whitespace-nowrap';

  return (
    <div className="bg-white shadow-md rounded-xl">
      <div className="p-4 md:p-6 border-b border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-semibold text-slate-800">Peringkat Penerima Bantuan</h2>
          <p className="mt-1 text-xs md:text-sm text-slate-500">Daftar warga layak menerima bantuan, diurutkan berdasarkan skor tertinggi.</p>
        </div>
        <div className="w-full md:w-auto space-y-2">
          <div>
            <label htmlFor="period" className="block text-xs md:text-sm font-medium text-slate-700">Periode Bantuan</label>
            <select
              id="period"
              value={selectedPeriod || ''}
              onChange={handlePeriodChange}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              {periods.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          {selectedPeriodData?.quota && (
            <div className="p-2 bg-blue-50 rounded border border-blue-200">
              <p className="text-xs font-medium text-blue-900">Quota: <span className="font-bold">{selectedPeriodData.quota} orang</span></p>
              <p className="text-xs text-blue-700 mt-1">Saat ini: <span className="font-bold">{selectedPeriodData.accepted_count ?? allBeneficiaries.length} Layak/Sangat Layak</span></p>
              <p className="text-xs text-blue-700 mt-1">Total data periode: <span className="font-bold">{selectedPeriodData.recipient_count ?? allBeneficiaries.length}</span></p>
            </div>
          )}
          {selectedPeriodData?.bwm_config?.weights && (
            <div className="p-2 bg-slate-50 rounded border border-slate-200">
              <p className="text-xs font-medium text-slate-800">Bobot Kriteria Periode</p>
              <div className="mt-1 space-y-1">
                {
                  (() => {
                    const weights = selectedPeriodData.bwm_config.weights || {};
                    const options = Array.isArray(selectedPeriodData.bwm_config.criteriaOptions) ? selectedPeriodData.bwm_config.criteriaOptions : [];
                    const BWM_VISIBLE_KEYS = ['income', 'house', 'family', 'employment'];

                    // Helper to get a readable label for a main key. Prefer explicit option label if present.
                    const getLabel = (key) => {
                      const exact = options.find((item) => item.key === key && !item.parentKey && !String(item.key).includes('.'));
                      if (exact && exact.label) return exact.label;
                      const map = {
                        income: 'Penghasilan Bulanan',
                        house: 'Kondisi Rumah',
                        family: 'Jumlah Tanggungan',
                        employment: 'Pekerjaan',
                      };
                      return map[key] || key;
                    };

                    // Compute aggregate weight for a main key: prefer explicit root weight, otherwise sum sub-keys
                    const getWeight = (key) => {
                      if (weights[key] !== undefined) return Number(weights[key]);
                      return Object.entries(weights).reduce((acc, [wk, wv]) => {
                        if (String(wk) === key || String(wk).startsWith(key + '.')) {
                          return acc + Number(wv || 0);
                        }
                        return acc;
                      }, 0);
                    };

                    return BWM_VISIBLE_KEYS.map((key) => {
                      const label = getLabel(key);
                      const value = getWeight(key);
                      return (
                        <div key={key} className="flex items-center justify-between text-xs text-slate-700">
                          <span>{label}</span>
                          <strong>{value.toFixed(4)}</strong>
                        </div>
                      );
                    });
                  })()
                }
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="p-4 md:p-6 flex flex-col gap-4">
        <div className="relative w-full md:w-80">
          <input
            type="text"
            placeholder="Cari nama..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border border-slate-300 rounded-md w-full focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-slate-400" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full">
          <div className="relative shrink-0">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="shrink-0 px-3 py-2 text-sm font-medium rounded-md bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="Semua">Semua</option>
              <option value="Sangat Layak">Sangat Layak</option>
              <option value="Layak">Layak</option>
              <option value="Tidak Layak">Tidak Layak</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2 pb-1 ml-auto justify-end">
            <button onClick={handleExport} title="Export ke Excel" className={`${actionButtonBaseClasses} text-slate-700 bg-white border border-slate-300 hover:bg-slate-50`}>
              <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              <span className="inline">Export</span>
            </button>
            <Link to={`/upload?periodId=${selectedPeriod}`} title="Upload Blanko" className={`${actionButtonBaseClasses} text-white bg-sky-600 shadow-sm hover:bg-sky-500 text-center`}>
              <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              <span className="inline">Upload</span>
            </Link>
            <Link to="/period/new" title="Tambah Periode Baru" className={`${actionButtonBaseClasses} text-white bg-indigo-600 shadow-sm hover:bg-indigo-500 text-center`}>
              <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              <span className="inline">Tambah Periode</span>
            </Link>
            {selectedPeriod && (
              <Link to={`/period/${selectedPeriod}/edit`} title="Edit Periode" className={`${actionButtonBaseClasses} font-semibold text-white bg-slate-700 shadow-sm hover:bg-slate-600 text-center`}>
                <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9"></path>
                  <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
                </svg>
                <span className="inline">Edit</span>
              </Link>
            )}
          </div>
        </div>
      </div>
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md m-4 md:m-6 text-red-800">
          <p className="font-semibold text-sm md:text-base">Error: {error}</p>
          <button onClick={() => window.location.reload()} className="mt-2 text-xs md:text-sm font-medium text-red-600 hover:text-red-800 underline">
            Muat Ulang Halaman
          </button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs md:text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
            <tr>
              <th className="p-2 md:p-4 font-medium">Peringkat</th>
              <th className="p-2 md:p-4 font-medium">Nama</th>
              <th className="p-2 md:p-4 font-medium">Skor</th>
              <th className="p-2 md:p-4 font-medium">Status</th>
              <th className="p-2 md:p-4 font-medium">Penghasilan</th>
              <th className="p-2 md:p-4 font-medium">Jumlah Tanggungan</th>
              <th className="p-2 md:p-4 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="p-4 md:p-8 text-center text-slate-500 text-sm">Memuat data...</td></tr>
            ) : allBeneficiaries.length === 0 ? (
              <tr><td colSpan={7} className="p-4 md:p-8 text-center text-slate-500 text-sm">Belum ada data penerima bansos untuk periode ini.</td></tr>
            ) : filteredBeneficiaries.map((person, index) => (
              <tr key={person.id} className="border-b border-slate-200 hover:bg-slate-50">
                <td className="p-2 md:p-4 text-slate-500">{person.rank || index + 1}</td>
                <td className="p-2 md:p-4 font-medium text-slate-900">{person.name}</td>
                <td className="p-2 md:p-4 text-slate-500">{person.score !== null ? Number(person.score).toFixed(2) : '-'}</td>
                <td className="p-2 md:p-4">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    person.status === 'Sangat Layak'
                      ? 'bg-green-100 text-green-800'
                      : person.status === 'Layak'
                      ? 'bg-blue-100 text-blue-800'
                      : person.status === 'Tidak Layak'
                      ? 'bg-orange-100 text-orange-800'
                      : 'bg-slate-100 text-slate-700'
                  }`}>
                    {person.status}
                  </span>
                </td>
                <td className="p-2 md:p-4 text-slate-500">
                  {person.income ? `Rp ${Number(person.income).toLocaleString('id-ID')}` : '-'}
                </td>
                <td className="p-2 md:p-4 text-slate-500">{person.dependents || '-'}</td>
                <td className="p-2 md:p-4">
                  <Link to={`/resident/${person.resident_id}/detail`} className="text-xs md:text-sm font-medium text-indigo-600 hover:text-indigo-800">Detail</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
