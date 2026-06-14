/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function NewResidentPage() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ktpFile, setKtpFile] = useState<File | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  type ResidentForm = {
    name: string;
    nik: string;
    family_card_no: string;
    rt: string;
    rw: string;
    dusun: string;
    desa: string;
    kecamatan: string;
    kabupaten: string;
    birth_place: string;
    birth_date: string;
    gender: string;
    marital_status: string;
    occupation: string;
    monthly_income: string;
    family_size: string;
    poverty_level: string;
    house_conditions: string;
  };

  const [formData, setFormData] = useState<ResidentForm>({
    name: '',
    nik: '',
    family_card_no: '',
    rt: '',
    rw: '',
    dusun: '',
    desa: '',
    kecamatan: '',
    kabupaten: '',
    birth_place: '',
    birth_date: '',
    gender: 'Laki-laki',
    marital_status: 'Belum Kawin',
    occupation: '',
    monthly_income: '',
    family_size: '',
    poverty_level: '',
    house_conditions: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const target = e.target as HTMLInputElement | HTMLSelectElement;
    const { name, value } = target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleScanKTP = async () => {
    if (!ktpFile) return;
    setIsScanning(true);

    const scanFormData = new FormData();
    scanFormData.append('ktp_image', ktpFile);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/ocr/upload-ktp', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: scanFormData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.details || errData?.error || 'Gagal memindai KTP.');
      }

      const data = await response.json();
      const extracted = data?.extracted_data || {};

      // Populate form with scanned data
      setFormData(prev => ({
        ...prev,
        name: extracted.name || prev.name,
        nik: extracted.nik || prev.nik,
        rt: extracted.rt || prev.rt,
        rw: extracted.rw || prev.rw,
        dusun: extracted.dusun || prev.dusun,
        desa: extracted.desa || prev.desa,
        kecamatan: extracted.kecamatan || prev.kecamatan,
        kabupaten: extracted.kabupaten || prev.kabupaten,
        birth_place: extracted.birth_place || prev.birth_place,
        birth_date: extracted.birth_date || prev.birth_date,
        gender: extracted.gender || prev.gender,
        occupation: extracted.occupation || prev.occupation,
      }));

    } catch (err) {
      console.error('Error scanning KTP:', err);
      const error = err as Error;
      alert(error.message);
    } finally {
      setIsScanning(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const submitUpsert = async (confirmUpdate = false) => {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/residents/upsert', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            ...formData,
            confirm_update: confirmUpdate
          }),
        });

        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.error || 'Failed to save resident');
        }
        return payload;
      };

      const upsertResult = await submitUpsert(false);

      if (upsertResult?.needs_confirmation) {
        const existing = upsertResult?.existing_resident || {};
        const shouldUpdate = window.confirm(
          `Data dengan NIK ${formData.nik} sudah ada (nama lama: ${existing.name || '-'}).\n\nApakah Anda ingin memperbarui data lama dengan data baru?`
        );

        if (!shouldUpdate) {
          setIsSubmitting(false);
          return;
        }

        await submitUpsert(true);
      }

      navigate('/residents'); // Redirect to residents list on success
    } catch (err) {
      console.error('Error adding resident:', err);
      const error = err as Error;
      alert(`Gagal menambah data penduduk: ${error.message}`);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white shadow-md rounded-xl max-w-2xl mx-auto">
      <div className="p-6 border-b border-slate-200">
        <h2 className="text-2xl font-semibold text-slate-800">Tambah Data Penduduk Baru</h2>
        <p className="mt-1 text-slate-500">Isi detail di bawah untuk mendaftarkan penduduk baru.</p>
      </div>
      <form onSubmit={handleSubmit} className="p-6">
        <div className="space-y-6">
          <div className="p-6 border border-slate-200 bg-slate-50 rounded-lg">
            <h3 className="text-lg font-medium text-slate-800">Scan KTP (Otomatis)</h3>
            <p className="text-sm text-slate-500 mt-1">Unggah foto KTP untuk mengisi data secara otomatis.</p>
            <div className="mt-4 flex items-center gap-4">
              <input
                type="file"
                id="ktp-file"
                onChange={(e) => setKtpFile(e.target.files ? e.target.files[0] : null)}
                accept="image/png, image/jpeg, image/webp"
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              />
              <button
                type="button"
                onClick={handleScanKTP}
                disabled={!ktpFile || isScanning}
                className="px-4 py-2 text-sm font-semibold text-white bg-sky-600 rounded-md shadow-sm hover:bg-sky-500 disabled:opacity-50 whitespace-nowrap"
              >
                {isScanning ? 'Memindai...' : 'Scan KTP'}
              </button>
            </div>
            {ktpFile && !isScanning && (
              <p className="mt-2 text-xs text-slate-500">File dipilih: {ktpFile.name}</p>
            )}
          </div>

          <div className="border-t border-slate-200 pt-6">
            <h3 className="text-lg font-medium text-slate-800 mb-4">Data Identitas</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-700">Nama Lengkap</label>
                <input type="text" name="name" id="name" value={formData.name} onChange={handleChange} required className="mt-1 block w-full rounded-md border-slate-300 shadow-sm" />
              </div>
              <div>
                <label htmlFor="nik" className="block text-sm font-medium text-slate-700">NIK</label>
                <input type="text" name="nik" id="nik" value={formData.nik} onChange={handleChange} required className="mt-1 block w-full rounded-md border-slate-300 shadow-sm" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                  <label htmlFor="birth_place" className="block text-sm font-medium text-slate-700">Tempat Lahir</label>
                  <input type="text" name="birth_place" id="birth_place" value={formData.birth_place} onChange={handleChange} required className="mt-1 block w-full rounded-md border-slate-300 shadow-sm" />
              </div>
              <div>
                  <label htmlFor="birth_date" className="block text-sm font-medium text-slate-700">Tanggal Lahir</label>
                  <input type="date" name="birth_date" id="birth_date" value={formData.birth_date} onChange={handleChange} required className="mt-1 block w-full rounded-md border-slate-300 shadow-sm" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="gender" className="block text-sm font-medium text-slate-700">Jenis Kelamin</label>
                <select
                  name="gender"
                  id="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full rounded-md border-slate-300 shadow-sm"
                >
                  <option value="Laki-laki">Laki-laki</option>
                  <option value="Perempuan">Perempuan</option>
                </select>
              </div>
              <div>
                  <label htmlFor="marital_status" className="block text-sm font-medium text-slate-700">Status Perkawinan</label>
                  <select name="marital_status" id="marital_status" value={formData.marital_status} onChange={handleChange} required className="mt-1 block w-full rounded-md border-slate-300 shadow-sm">
                      <option>Belum Kawin</option>
                      <option>Kawin</option>
                      <option>Cerai Hidup</option>
                      <option>Cerai Mati</option>
                  </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                  <label htmlFor="occupation" className="block text-sm font-medium text-slate-700">Pekerjaan</label>
                  <input type="text" name="occupation" id="occupation" value={formData.occupation} onChange={handleChange} required className="mt-1 block w-full rounded-md border-slate-300 shadow-sm" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="rt" className="block text-sm font-medium text-slate-700">RT</label>
                <input type="text" name="rt" id="rt" value={formData.rt} onChange={handleChange} required className="mt-1 block w-full rounded-md border-slate-300 shadow-sm" />
              </div>
              <div>
                <label htmlFor="rw" className="block text-sm font-medium text-slate-700">RW</label>
                <input type="text" name="rw" id="rw" value={formData.rw} onChange={handleChange} required className="mt-1 block w-full rounded-md border-slate-300 shadow-sm" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="dusun" className="block text-sm font-medium text-slate-700">Dusun</label>
                <input type="text" name="dusun" id="dusun" value={formData.dusun} onChange={handleChange} required className="mt-1 block w-full rounded-md border-slate-300 shadow-sm" />
              </div>
              <div>
                <label htmlFor="desa" className="block text-sm font-medium text-slate-700">Desa</label>
                <input type="text" name="desa" id="desa" value={formData.desa} onChange={handleChange} required className="mt-1 block w-full rounded-md border-slate-300 shadow-sm" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="kecamatan" className="block text-sm font-medium text-slate-700">Kecamatan</label>
                <input type="text" name="kecamatan" id="kecamatan" value={formData.kecamatan} onChange={handleChange} required className="mt-1 block w-full rounded-md border-slate-300 shadow-sm" />
              </div>
              <div>
                <label htmlFor="kabupaten" className="block text-sm font-medium text-slate-700">Kabupaten</label>
                <input type="text" name="kabupaten" id="kabupaten" value={formData.kabupaten} onChange={handleChange} required className="mt-1 block w-full rounded-md border-slate-300 shadow-sm" />
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-6">
            <h3 className="text-lg font-medium text-slate-800 mb-4">Data Kriteria</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="monthly_income" className="block text-sm font-medium text-slate-700">Penghasilan Bulanan</label>
                <input type="number" step="any" name="monthly_income" id="monthly_income" value={formData.monthly_income} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm" />
              </div>
              <div>
                <label htmlFor="family_size" className="block text-sm font-medium text-slate-700">Jumlah Tanggungan</label>
                <input type="number" min="0" step="1" name="family_size" id="family_size" value={formData.family_size} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="poverty_level" className="block text-sm font-medium text-slate-700">Tingkat Kemiskinan</label>
                <input type="text" name="poverty_level" id="poverty_level" value={formData.poverty_level} onChange={handleChange} placeholder="Sangat Miskin / Miskin / Hampir Miskin / Tidak Miskin" className="mt-1 block w-full rounded-md border-slate-300 shadow-sm" />
              </div>
              <div>
                <label htmlFor="house_conditions" className="block text-sm font-medium text-slate-700">Kondisi Rumah</label>
                <input type="text" name="house_conditions" id="house_conditions" value={formData.house_conditions} onChange={handleChange} placeholder="Tidak Layak / Kurang Layak / Layak / Baik" className="mt-1 block w-full rounded-md border-slate-300 shadow-sm" />
              </div>
            </div>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-slate-200 flex justify-between items-center">
          <button type="button" onClick={() => navigate(-1)} className="text-sm font-medium text-slate-600 hover:text-slate-800">
            Batal
          </button>
          <button type="submit" disabled={isSubmitting} className="px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-500 disabled:opacity-50">
            {isSubmitting ? 'Menyimpan...' : 'Simpan Penduduk'}
          </button>
        </div>
      </form>
    </div>
  );
}
