/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FileUp } from 'lucide-react';

interface ResidentListItem {
  id: number;
  name: string;
  nik: string;
}

interface CriteriaOption {
  key: string;
  label: string;
}

export default function UploadPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nik, setNik] = useState('');
  const [name, setName] = useState('');
  const [isNameAutoFilled, setIsNameAutoFilled] = useState(false);
  const [isCheckingNik, setIsCheckingNik] = useState(false);
  const [matchedResident, setMatchedResident] = useState<ResidentListItem | null>(null);

  const [criteriaOptions, setCriteriaOptions] = useState<CriteriaOption[]>([]);
  const [criteriaScores, setCriteriaScores] = useState<Record<string, string>>({});

  const periodId = useMemo(() => {
    return new URLSearchParams(location.search).get('periodId');
  }, [location.search]);

  useEffect(() => {
    const fetchCriteria = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/beneficiaries/bwm-config', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          return;
        }

        const payload = await response.json();
        const options = Array.isArray(payload?.criteriaOptions)
          ? payload.criteriaOptions
              .map((item: any) => ({
                key: String(item?.key || '').trim().toLowerCase(),
                label: String(item?.label || item?.key || '').trim(),
              }))
              .filter((item: CriteriaOption) => item.key && item.label)
          : [];

        setCriteriaOptions(options);
        setCriteriaScores((prev) => {
          const next: Record<string, string> = {};
          options.forEach((item: CriteriaOption) => {
            next[item.key] = prev[item.key] || '';
          });
          return next;
        });
      } catch (err) {
        console.error('Failed to load criteria options:', err);
      }
    };

    fetchCriteria();
  }, []);

  useEffect(() => {
    const normalizedNik = nik.replace(/\D/g, '');

    if (!normalizedNik) {
      setMatchedResident(null);
      if (isNameAutoFilled) {
        setName('');
        setIsNameAutoFilled(false);
      }
      return;
    }

    const timeout = window.setTimeout(async () => {
      setIsCheckingNik(true);

      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/residents?search=${encodeURIComponent(normalizedNik)}&limit=50`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          setMatchedResident(null);
          return;
        }

        const payload = await response.json();
        const items: ResidentListItem[] = Array.isArray(payload?.items) ? payload.items : [];
        const exactMatch = items.find((item) => String(item?.nik || '').trim() === normalizedNik) || null;

        setMatchedResident(exactMatch);

        if (exactMatch) {
          setName(exactMatch.name || '');
          setIsNameAutoFilled(true);
        } else if (isNameAutoFilled) {
          setName('');
          setIsNameAutoFilled(false);
        }
      } catch {
        setMatchedResident(null);
      } finally {
        setIsCheckingNik(false);
      }
    }, 400);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [nik, isNameAutoFilled]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleSubmit = async () => {
    if (!file || !periodId) {
      setError('File atau periode bantuan belum dipilih.');
      return;
    }

    const normalizedNik = nik.replace(/\D/g, '');
    if (!normalizedNik) {
      setError('NIK wajib diisi.');
      return;
    }

    if (!name.trim()) {
      setError('Nama penduduk wajib diisi.');
      return;
    }

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('blanko', file);
    formData.append('periodId', periodId);
    formData.append('nik', normalizedNik);
    formData.append('name', name.trim());
    formData.append('resident_exists', matchedResident ? 'true' : 'false');

    if (matchedResident?.id) {
      formData.append('resident_id', String(matchedResident.id));
    }

    const normalizedCriteriaScores = Object.entries(criteriaScores).reduce((acc, [key, rawValue]) => {
      const value = String(rawValue ?? '').trim();
      if (!value) {
        acc[key] = null;
        return acc;
      }

      const parsed = Number(value);
      acc[key] = Number.isFinite(parsed) ? parsed : null;
      return acc;
    }, {} as Record<string, number | null>);

    formData.append('criteria_scores', JSON.stringify(normalizedCriteriaScores));

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/upload-blanko', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Gagal mengunggah dan memproses formulir.');
      }

      alert('Formulir berhasil diunggah dan data warga telah diproses!');
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat upload.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-white shadow-md rounded-xl max-w-2xl mx-auto">
      <div className="p-6 border-b border-slate-200">
        <h2 className="text-2xl font-semibold text-slate-800">Upload Blanko Otomatis</h2>
        <p className="mt-1 text-slate-500">Unggah foto atau hasil scan formulir untuk ekstraksi data otomatis.</p>
      </div>
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border border-slate-200 rounded-lg bg-slate-50">
          <div>
            <label htmlFor="nik" className="block text-sm font-medium text-slate-700">NIK</label>
            <input
              id="nik"
              type="text"
              value={nik}
              onChange={(e) => setNik(e.target.value.replace(/\D/g, ''))}
              placeholder="Masukkan NIK"
              className="mt-1 block w-full rounded-md border-slate-300 shadow-sm"
            />
            {isCheckingNik && <p className="mt-1 text-xs text-slate-500">Mencari data berdasarkan NIK...</p>}
          </div>
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-slate-700">Nama Penduduk</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setIsNameAutoFilled(false);
              }}
              placeholder={matchedResident ? 'Nama terisi otomatis dari NIK' : 'Masukkan nama penduduk'}
              readOnly={Boolean(matchedResident)}
              className="mt-1 block w-full rounded-md border-slate-300 shadow-sm read-only:bg-slate-100"
            />
            <p className="mt-1 text-xs text-slate-500">
              {matchedResident
                ? `NIK ditemukan. Data akan memperbarui penduduk: ${matchedResident.name}`
                : 'NIK belum terdaftar. Silakan isi nama untuk data penduduk baru.'}
            </p>
          </div>
        </div>

        {criteriaOptions.length > 0 && (
          <div className="p-4 border border-slate-200 rounded-lg">
            <h3 className="text-sm font-semibold text-slate-800">Kriteria</h3>
            <p className="mt-1 text-xs text-slate-500">Isi nilai kriteria untuk penduduk ini (opsional).</p>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
              {criteriaOptions.map((item) => (
                <div key={item.key}>
                  <label htmlFor={`criteria_${item.key}`} className="block text-sm font-medium text-slate-700">
                    {item.label}
                  </label>
                  <input
                    id={`criteria_${item.key}`}
                    type="number"
                    step="any"
                    value={criteriaScores[item.key] || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setCriteriaScores((prev) => ({ ...prev, [item.key]: value }));
                    }}
                    className="mt-1 block w-full rounded-md border-slate-300 shadow-sm"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-center w-full">
          <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-64 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <FileUp className="w-10 h-10 mb-4 text-slate-500" />
              <p className="mb-2 text-sm text-slate-500"><span className="font-semibold">Klik untuk memilih</span> atau seret file</p>
              <p className="text-xs text-slate-500">PNG, JPG, atau WEBP</p>
            </div>
            <input id="dropzone-file" type="file" className="hidden" onChange={handleFileChange} accept="image/png, image/jpeg, image/webp" />
          </label>
        </div>

        {file && (
          <div className="text-center">
            <p className="text-sm font-medium text-slate-700">File dipilih: {file.name}</p>
            <img src={URL.createObjectURL(file)} alt="Preview" className="mt-2 mx-auto max-h-40 rounded-lg" />
          </div>
        )}

        {error && <p className="text-sm text-center text-red-600">{error}</p>}

        <div className="pt-6 border-t border-slate-200 flex justify-between items-center">
          <button type="button" onClick={() => navigate(-1)} className="text-sm font-medium text-slate-600 hover:text-slate-800">
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isUploading || !file || !nik || !name}
            className="px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-500 disabled:opacity-50"
          >
            {isUploading ? 'Memproses...' : 'Upload & Proses'}
          </button>
        </div>
      </div>
    </div>
  );
}
