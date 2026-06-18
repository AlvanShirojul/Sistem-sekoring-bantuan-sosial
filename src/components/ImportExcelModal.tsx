/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import React from 'react';

// XLSX is kept here since it's used for parsing file uploads
// which is distinct from export functionality

export default function ImportExcelModal({ isOpen, onClose, onImportSuccess }) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState([]);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState('');
  const [importResult, setImportResult] = useState(null);
  const [progress, setProgress] = useState(0);
  const [criteriaKeys, setCriteriaKeys] = useState<string[]>([]);

  const templateHeaders = useMemo(() => ([
    'name',
    'nik',
    'family_card_no',
    'rt',
    'rw',
    'dusun',
    'desa',
    'kecamatan',
    'kabupaten',
    'birth_place',
    'birth_date',
    'gender',
    'marital_status',
    'occupation',
    'monthly_income',
    'poverty_level',
    'house_conditions',
    'family_size',
    'phone_number',
    'email',
    'education',
    ...criteriaKeys.map((key) => `criteria_${key}`),
  ]), [criteriaKeys]);

  useEffect(() => {
    if (!isOpen) return;

    const fetchCriteriaKeys = async () => {
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
        const keys = Array.isArray(payload?.criteriaOptions)
          ? payload.criteriaOptions
              .map((item: any) => String(item?.key || '').trim().toLowerCase())
              .filter((k: string) => k && !k.includes('.'))
          : [];
        setCriteriaKeys(Array.from(new Set(keys)));
      } catch (err) {
        console.error('Failed to load criteria keys for template:', err);
      }
    };

    fetchCriteriaKeys();
  }, [isOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files ? e.target.files[0] : null;
    setFile(selectedFile);
    setParsedData([]);
    setError('');
    setImportResult(null);

    if (selectedFile) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const bstr = event.target.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
          
          if (data.length < 2) {
            setError('File Excel kosong atau hanya berisi header.');
            return;
          }

          const headers = data[0].map(h => h.toString().toLowerCase().replace(/ /g, '_'));
          const requiredHeaders = ['name', 'nik']; // Keep it simple, only name and NIK are truly required
          if (!requiredHeaders.every(h => headers.includes(h))) {
            setError('Header file Excel harus mengandung kolom \'name\' dan \'nik\'.');
            return;
          }

          const jsonData = data.slice(1).map(row => {
            let obj = {};
            headers.forEach((key, index) => {
                obj[key] = row[index];
            });
            return obj;
          });

          setParsedData(jsonData);
        } catch (err) {
          setError('Gagal mem-parsing file. Pastikan formatnya benar.');
          console.error(err);
        }
      };
      reader.readAsBinaryString(selectedFile);
    }
  };

  const handleDownloadTemplate = () => {
    const sampleRow: Record<string, string | number> = {
      name: 'Contoh Nama',
      nik: '3201000000000001',
      family_card_no: '3201000000000002',
      rt: '001',
      rw: '002',
      dusun: 'Dusun Mawar',
      desa: 'Desa Sukamaju',
      kecamatan: 'Kecamatan Maju',
      kabupaten: 'Kabupaten Sejahtera',
      birth_place: 'Bandung',
      birth_date: '1990-01-01',
      gender: 'L',
      marital_status: 'Menikah',
      occupation: 'Wiraswasta',
      monthly_income: 1500000,
      poverty_level: 'Miskin',
      house_conditions: 'Kurang Layak',
      family_size: 4,
      phone_number: '081234567890',
      email: 'contoh@warga.id',
      education: 'SMA',
    };

    for (const key of criteriaKeys) {
      sampleRow[`criteria_${key}`] = 0;
    }

    const ws = XLSX.utils.aoa_to_sheet([
      templateHeaders,
      templateHeaders.map((header) => sampleRow[header] ?? ''),
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'template_import_penduduk.xlsx');
  };

  const handleImport = async () => {
    if (parsedData.length === 0) {
      setError('Tidak ada data untuk diimpor.');
      return;
    }
    setIsImporting(true);
    setError('');
    setImportResult(null);
    setProgress(0);

    try {
      // Split data into chunks of 500 for better performance
      const chunkSize = 500;
      const chunks = [];
      for (let i = 0; i < parsedData.length; i += chunkSize) {
        chunks.push(parsedData.slice(i, i + chunkSize));
      }

      let totalSuccessful = 0;
      let totalFailed = 0;
      let allErrors = [];

      // Send chunks sequentially
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        try {
          const token = localStorage.getItem('token');
          const response = await fetch('/api/residents/bulk', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(chunk),
          });

          const result = await response.json();
          if (!response.ok) {
            throw new Error(result.error || 'Terjadi kesalahan saat mengimpor.');
          }

          totalSuccessful += result.successful || chunk.length;
          totalFailed += result.failed || 0;
          if (result.errors) {
            allErrors = [...allErrors, ...result.errors];
          }

          // Update progress
          setProgress(Math.round(((i + 1) / chunks.length) * 100));
        } catch (err) {
          console.error(`Chunk ${i + 1} failed:`, err);
          setError(`Error on chunk ${i + 1}: ${err.message}`);
          setIsImporting(false);
          return;
        }
      }

      setImportResult({
        message: `Impor selesai. Berhasil: ${totalSuccessful}, Gagal: ${totalFailed}`,
        successful: totalSuccessful,
        failed: totalFailed,
        errors: allErrors
      });
      onImportSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsImporting(false);
      setProgress(0);
    }
  };
  
  const resetAndClose = () => {
      setFile(null);
      setParsedData([]);
      setError('');
      setImportResult(null);
      setIsImporting(false);
      onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-[var(--color-mint)]/45">
        <div className="p-6 border-b border-[var(--color-mint)]/35 bg-gradient-to-r from-[var(--color-navy)] via-[var(--color-teal-dark)] to-[var(--color-teal)] rounded-t-xl">
          <h2 className="text-xl font-semibold text-white">Impor Penduduk dari Excel</h2>
          <p className="text-sm text-[var(--color-surface)]/90 mt-1">Unggah file .xlsx dengan kolom 'name', 'nik', dan lainnya.</p>
        </div>
        <div className="p-6 overflow-y-auto">
          {!importResult ? (
            <>
              {isImporting && (
                <div className="mb-4 p-4 bg-[var(--color-mint)]/20 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-sm font-medium text-[var(--color-navy)]">Sedang mengimpor data...</p>
                    <p className="text-sm font-medium text-[var(--color-navy)]">{progress}%</p>
                  </div>
                  <div className="w-full bg-[var(--color-mint)]/45 rounded-full h-2">
                    <div 
                      className="bg-[var(--color-teal-dark)] h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>
              )}
              <div className="mt-3 flex flex-row items-center justify-between gap-3">
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept=".xlsx, .xls"
                  disabled={isImporting}
                  className="block flex-1 min-w-0 text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[var(--color-mint)]/35 file:text-[var(--color-navy)] hover:file:bg-[var(--color-mint)]/50 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="px-4 py-2 text-sm font-medium text-[var(--color-navy)] bg-[var(--color-mint)]/35 border border-[var(--color-mint)]/70 rounded-md hover:bg-[var(--color-mint)]/50 whitespace-nowrap shrink-0"
                >
                  Download Template Excel
                </button>
              </div>
              {error && <p className="text-red-600 text-sm mt-4">{error}</p>}
              {parsedData.length > 0 && (
                <div className="mt-4 border rounded-lg overflow-hidden">
                  <p className="p-3 bg-slate-50 text-sm font-medium">Pratinjau Data ({parsedData.length} baris ditemukan):</p>
                  <div className="overflow-auto max-h-60">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-100">
                        <tr>
                          {Object.keys(parsedData[0]).map(key => <th key={key} className="px-4 py-2 text-left font-medium">{key}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {parsedData.slice(0, 10).map((row, i) => (
                          <tr key={i} className="border-t">
                            {Object.values(row).map((val, j) => <td key={j} className="px-4 py-2 truncate">{val}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                     {parsedData.length > 10 && <p className="text-center text-xs p-2 bg-slate-50">...dan {parsedData.length - 10} baris lainnya.</p>}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div>
              <h3 className="text-lg font-medium text-slate-800">Hasil Impor</h3>
              <p className="text-slate-600 mt-2">{importResult.message}</p>
              {importResult.errors && importResult.errors.length > 0 && (
                <div className="mt-4">
                  <p className="font-medium text-red-700">Detail Kegagalan:</p>
                  <ul className="list-disc list-inside text-sm text-red-600 mt-2 max-h-48 overflow-y-auto">
                    {importResult.errors.map((err, i) => (
                      <li key={i}>{err.resident.name || 'Baris tanpa nama'}: {err.error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="p-6 border-t border-[var(--color-mint)]/35 bg-[var(--color-surface)] flex justify-between items-center rounded-b-xl">
          <button onClick={resetAndClose} className="text-sm font-medium text-slate-600 hover:text-[var(--color-navy)]">
            {importResult ? 'Tutup' : 'Batal'}
          </button>
          {!importResult && (
            <button 
              onClick={handleImport}
              disabled={isImporting || parsedData.length === 0}
              className="px-6 py-2.5 text-sm font-semibold text-white bg-[var(--color-teal-dark)] rounded-md shadow-sm hover:bg-[var(--color-teal)] disabled:opacity-50">
              {isImporting ? 'Mengimpor...' : `Impor ${parsedData.length} Data`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
