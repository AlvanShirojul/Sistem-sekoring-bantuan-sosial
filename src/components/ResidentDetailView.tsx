import React, { useState, useEffect } from 'react';

interface ResidentDetail {
  id: number;
  name: string;
  nik: string;
  family_card_no?: string;
  address?: string;
  rt?: string;
  rw?: string;
  dusun?: string;
  desa?: string;
  kecamatan?: string;
  kabupaten?: string;
  birth_place?: string;
  birth_date?: string;
  gender?: string;
  marital_status?: string;
  occupation?: string;
  phone_number?: string;
  email?: string;
  education?: string;
  saw_score?: number | null;
  saw_status?: string;
  saw_rank?: number | null;
  monthly_income?: number | null;
  poverty_level?: string | null;
  house_conditions?: string | null;
  family_size?: number | null;
  criteria_scores?: Record<string, number | null>;
  created_at?: string;
  [key: string]: unknown;
}

interface ResidentDetailViewProps {
  residentId: number;
}

export default function ResidentDetailView({ residentId }: ResidentDetailViewProps) {
  const [resident, setResident] = useState<ResidentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState<ResidentDetail | null>(null);

  const labelMap: Record<string, string> = {
    id: 'ID',
    name: 'Nama',
    nik: 'NIK',
    family_card_no: 'No. Kartu Keluarga',
    address: 'Alamat',
    rt: 'RT',
    rw: 'RW',
    dusun: 'Dusun',
    desa: 'Desa',
    kecamatan: 'Kecamatan',
    kabupaten: 'Kabupaten',
    birth_place: 'Tempat Lahir',
    birth_date: 'Tanggal Lahir',
    gender: 'Jenis Kelamin',
    marital_status: 'Status Perkawinan',
    occupation: 'Pekerjaan',
    phone_number: 'No. Telepon',
    email: 'Email',
    education: 'Pendidikan',
    monthly_income: 'Penghasilan Bulanan',
    poverty_level: 'Tingkat Kemiskinan',
    house_conditions: 'Kondisi Rumah',
    family_size: 'Jumlah Tanggungan',
    created_at: 'Dibuat Pada',
    saw_score: 'Skor SAW',
    saw_status: 'Status SAW',
    saw_rank: 'Ranking SAW',
  };

  const toDisplayLabel = (key: string) =>
    labelMap[key] ||
    key
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

  const toDisplayValue = (value: unknown, key?: string) => {
    if (value === null || value === undefined || value === '') {
      return '-';
    }
    if (typeof value === 'number') {
      if (key === 'monthly_income') {
        return `Rp ${value.toLocaleString('id-ID')}`;
      }
      return Number.isFinite(value) ? value.toString() : '-';
    }
    if (typeof value === 'string') {
      if ((key === 'birth_date' || key === 'created_at') && value.includes('T')) {
        return value.split('T')[0];
      }
      return value;
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  };

  useEffect(() => {
    const controller = new AbortController();
    loadResident(controller.signal);
    return () => controller.abort();
  }, [residentId]);

  const loadResident = async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/residents/${residentId}`, {
        signal,
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || 'Failed to load resident');
      }
      const data = await response.json();
      setResident(data);
      setFormData(data);
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        return;
      }
      setError((err as Error).message);
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) return;

    setError('');
    try {
      const normalizedCriteriaScores = Object.entries(formData.criteria_scores || {}).reduce(
        (acc, [key, value]) => {
          if (value === null || value === undefined || value === '') {
            acc[key] = null;
            return acc;
          }

          const parsed = typeof value === 'number' ? value : Number(value);
          acc[key] = Number.isFinite(parsed) ? parsed : null;
          return acc;
        },
        {} as Record<string, number | null>
      );

      const payload = {
        ...formData,
        criteria_scores: normalizedCriteriaScores,
      };

      const token = localStorage.getItem('token');
      const response = await fetch(`/api/residents/${residentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || 'Failed to update resident');
      }
      
      setResident(payload);
      setFormData(payload);
      setEditing(false);
      alert('Data penduduk berhasil diperbarui');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (loading) return <p>Loading...</p>;
  if (error) return <div className="bg-red-100 text-red-700 p-3 rounded">{error}</div>;
  if (!resident) return <p>Resident not found</p>;

  const hiddenKeys = new Set(['criteria_scores']);
  const dynamicEntries = Object.entries(resident).filter(([key]) => !hiddenKeys.has(key));
  const criteriaEntries = Object.entries(resident.criteria_scores || {});

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Detail Penduduk</h2>
        <button
          onClick={() => {
            if (editing) {
              setFormData(resident);
            }
            setEditing(!editing);
          }}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          {editing ? 'Batal' : 'Edit'}
        </button>
      </div>

      {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Basic Information */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Nama</label>
            <input
              type="text"
              disabled={!editing}
              value={formData?.name || ''}
              onChange={(e) => formData && setFormData({ ...formData, name: e.target.value })}
              className="mt-1 block w-full rounded border-gray-300 border p-2 disabled:bg-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">NIK</label>
            <input
              type="text"
              disabled={!editing}
              value={formData?.nik || ''}
              onChange={(e) => formData && setFormData({ ...formData, nik: e.target.value })}
              className="mt-1 block w-full rounded border-gray-300 border p-2 disabled:bg-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">No. Kartu Keluarga</label>
            <input
              type="text"
              disabled={!editing}
              value={formData?.family_card_no || ''}
              onChange={(e) => formData && setFormData({ ...formData, family_card_no: e.target.value })}
              className="mt-1 block w-full rounded border-gray-300 border p-2 disabled:bg-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Jenis Kelamin</label>
            <select
              disabled={!editing}
              value={formData?.gender || ''}
              onChange={(e) => formData && setFormData({ ...formData, gender: e.target.value })}
              className="mt-1 block w-full rounded border-gray-300 border p-2 disabled:bg-gray-100"
            >
              <option value="">Pilih</option>
              <option value="Laki-laki">Laki-laki</option>
              <option value="Perempuan">Perempuan</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Tempat Lahir</label>
            <input
              type="text"
              disabled={!editing}
              value={formData?.birth_place || ''}
              onChange={(e) => formData && setFormData({ ...formData, birth_place: e.target.value })}
              className="mt-1 block w-full rounded border-gray-300 border p-2 disabled:bg-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Tanggal Lahir</label>
            <input
              type="date"
              disabled={!editing}
              value={formData?.birth_date || ''}
              onChange={(e) => formData && setFormData({ ...formData, birth_date: e.target.value })}
              className="mt-1 block w-full rounded border-gray-300 border p-2 disabled:bg-gray-100"
            />
          </div>

          {/* Contact Information */}
          <div>
            <label className="block text-sm font-medium text-gray-700">No. Telepon</label>
            <input
              type="tel"
              disabled={!editing}
              value={formData?.phone_number || ''}
              onChange={(e) => formData && setFormData({ ...formData, phone_number: e.target.value })}
              className="mt-1 block w-full rounded border-gray-300 border p-2 disabled:bg-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              disabled={!editing}
              value={formData?.email || ''}
              onChange={(e) => formData && setFormData({ ...formData, email: e.target.value })}
              className="mt-1 block w-full rounded border-gray-300 border p-2 disabled:bg-gray-100"
            />
          </div>

          {/* Employment & Education */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Pekerjaan</label>
            <input
              type="text"
              disabled={!editing}
              value={formData?.occupation || ''}
              onChange={(e) => formData && setFormData({ ...formData, occupation: e.target.value })}
              className="mt-1 block w-full rounded border-gray-300 border p-2 disabled:bg-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Pendidikan</label>
            <select
              disabled={!editing}
              value={formData?.education || ''}
              onChange={(e) => formData && setFormData({ ...formData, education: e.target.value })}
              className="mt-1 block w-full rounded border-gray-300 border p-2 disabled:bg-gray-100"
            >
              <option value="">Pilih</option>
              <option value="Tidak Sekolah">Tidak Sekolah</option>
              <option value="SD">SD</option>
              <option value="SMP">SMP</option>
              <option value="SMA">SMA</option>
              <option value="Diploma">Diploma</option>
              <option value="Sarjana">Sarjana</option>
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Status Perkawinan</label>
            <select
              disabled={!editing}
              value={formData?.marital_status || ''}
              onChange={(e) => formData && setFormData({ ...formData, marital_status: e.target.value })}
              className="mt-1 block w-full rounded border-gray-300 border p-2 disabled:bg-gray-100"
            >
              <option value="">Pilih</option>
              <option value="Belum Menikah">Belum Menikah</option>
              <option value="Menikah">Menikah</option>
              <option value="Cerai Hidup">Cerai Hidup</option>
              <option value="Cerai Mati">Cerai Mati</option>
            </select>
          </div>

          {/* Structured Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700">RT</label>
            <input
              type="text"
              disabled={!editing}
              value={formData?.rt || ''}
              onChange={(e) => formData && setFormData({ ...formData, rt: e.target.value })}
              className="mt-1 block w-full rounded border-gray-300 border p-2 disabled:bg-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Skor SAW</label>
            <input
              type="text"
              disabled
              value={resident?.saw_score !== null && resident?.saw_score !== undefined ? Number(resident.saw_score).toFixed(2) : '-'}
              className="mt-1 block w-full rounded border-gray-300 border p-2 disabled:bg-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Status SAW</label>
            <input
              type="text"
              disabled
              value={resident?.saw_status || '-'}
              className="mt-1 block w-full rounded border-gray-300 border p-2 disabled:bg-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Ranking SAW</label>
            <input
              type="text"
              disabled
              value={resident?.saw_rank ?? '-'}
              className="mt-1 block w-full rounded border-gray-300 border p-2 disabled:bg-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">RW</label>
            <input
              type="text"
              disabled={!editing}
              value={formData?.rw || ''}
              onChange={(e) => formData && setFormData({ ...formData, rw: e.target.value })}
              className="mt-1 block w-full rounded border-gray-300 border p-2 disabled:bg-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Dusun</label>
            <input
              type="text"
              disabled={!editing}
              value={formData?.dusun || ''}
              onChange={(e) => formData && setFormData({ ...formData, dusun: e.target.value })}
              className="mt-1 block w-full rounded border-gray-300 border p-2 disabled:bg-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Desa</label>
            <input
              type="text"
              disabled={!editing}
              value={formData?.desa || ''}
              onChange={(e) => formData && setFormData({ ...formData, desa: e.target.value })}
              className="mt-1 block w-full rounded border-gray-300 border p-2 disabled:bg-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Kecamatan</label>
            <input
              type="text"
              disabled={!editing}
              value={formData?.kecamatan || ''}
              onChange={(e) => formData && setFormData({ ...formData, kecamatan: e.target.value })}
              className="mt-1 block w-full rounded border-gray-300 border p-2 disabled:bg-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Kabupaten</label>
            <input
              type="text"
              disabled={!editing}
              value={formData?.kabupaten || ''}
              onChange={(e) => formData && setFormData({ ...formData, kabupaten: e.target.value })}
              className="mt-1 block w-full rounded border-gray-300 border p-2 disabled:bg-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Penghasilan Bulanan</label>
            <input
              type="number"
              step="any"
              disabled={!editing}
              value={formData?.monthly_income ?? ''}
              onChange={(e) =>
                formData &&
                setFormData({
                  ...formData,
                  monthly_income: e.target.value === '' ? null : Number(e.target.value),
                })
              }
              className="mt-1 block w-full rounded border-gray-300 border p-2 disabled:bg-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Jumlah Tanggungan</label>
            <input
              type="number"
              step="1"
              min="0"
              disabled={!editing}
              value={formData?.family_size ?? ''}
              onChange={(e) =>
                formData &&
                setFormData({
                  ...formData,
                  family_size: e.target.value === '' ? null : Number(e.target.value),
                })
              }
              className="mt-1 block w-full rounded border-gray-300 border p-2 disabled:bg-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Tingkat Kemiskinan</label>
            <input
              type="text"
              disabled={!editing}
              value={formData?.poverty_level ?? ''}
              onChange={(e) =>
                formData && setFormData({ ...formData, poverty_level: e.target.value })
              }
              placeholder="Contoh: Sangat Miskin / Miskin / Hampir Miskin / Tidak Miskin"
              className="mt-1 block w-full rounded border-gray-300 border p-2 disabled:bg-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Kondisi Rumah</label>
            <input
              type="text"
              disabled={!editing}
              value={formData?.house_conditions ?? ''}
              onChange={(e) =>
                formData && setFormData({ ...formData, house_conditions: e.target.value })
              }
              placeholder="Contoh: Tidak Layak / Kurang Layak / Layak / Baik"
              className="mt-1 block w-full rounded border-gray-300 border p-2 disabled:bg-gray-100"
            />
          </div>

        </div>

        <div className="pt-2">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Semua Kolom Data Penduduk</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dynamicEntries.map(([key, value]) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700">{toDisplayLabel(key)}</label>
                <input
                  type="text"
                  disabled
                  value={toDisplayValue(value, key)}
                  className="mt-1 block w-full rounded border-gray-300 border p-2 disabled:bg-gray-100"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="pt-2">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Kriteria Tambahan (criteria_scores)</h3>
          {criteriaEntries.length === 0 ? (
            <p className="text-sm text-gray-500">Belum ada kriteria tambahan.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {criteriaEntries.map(([key, value]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700">{toDisplayLabel(key)}</label>
                  <input
                    type="text"
                    disabled
                    value={toDisplayValue(value, key)}
                    className="mt-1 block w-full rounded border-gray-300 border p-2 disabled:bg-gray-100"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {editing && (
          <div className="flex gap-2">
            <button
              type="submit"
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
            >
              Simpan
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setFormData(resident);
              }}
              className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
            >
              Batal
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
