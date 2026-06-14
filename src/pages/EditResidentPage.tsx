/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

export default function EditResidentPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [formData, setFormData] = useState({
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
    phone_number: '',
    email: '',
    monthly_income: '',
    family_size: '',
    poverty_level: '',
    house_conditions: '',
  });

  useEffect(() => {
    setIsLoading(true);
    const token = localStorage.getItem('token');
    fetch(`/api/resident/${id}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => {
        if (!res.ok) throw new Error('Resident not found');
        return res.json();
      })
      .then(data => {
        setFormData({
          name: data.name || '',
          nik: data.nik || '',
          family_card_no: data.family_card_no || '',
          rt: data.rt || '',
          rw: data.rw || '',
          dusun: data.dusun || '',
          desa: data.desa || '',
          kecamatan: data.kecamatan || '',
          kabupaten: data.kabupaten || '',
          birth_place: data.birth_place || '',
          birth_date: data.birth_date ? data.birth_date.split('T')[0] : '',
          gender: data.gender || 'Laki-laki',
          marital_status: data.marital_status || 'Belum Kawin',
          occupation: data.occupation || '',
          phone_number: data.phone_number || '',
          email: data.email || '',
          monthly_income: data.monthly_income ?? '',
          family_size: data.family_size ?? '',
          poverty_level: data.poverty_level || '',
          house_conditions: data.house_conditions || '',
        });
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch resident:", err);
        alert('Gagal memuat data penduduk.');
        navigate('/residents');
      });
  }, [id, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/resident/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to update resident');
      }

      navigate('/residents'); // Redirect to residents list on success
    } catch (error) {
      console.error('Error updating resident:', error);
      alert(`Gagal memperbarui data: ${error.message}`);
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="text-center p-8">Memuat data...</div>;
  }

  return (
    <div className="bg-white shadow-md rounded-xl max-w-2xl mx-auto">
      <div className="p-6 border-b border-slate-200">
        <h2 className="text-2xl font-semibold text-slate-800">Edit Data Penduduk</h2>
      </div>
      <form onSubmit={handleSubmit} className="p-6">
        <div className="space-y-6">
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
                <input type="text" name="birth_place" id="birth_place" value={formData.birth_place} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm" />
            </div>
            <div>
                <label htmlFor="birth_date" className="block text-sm font-medium text-slate-700">Tanggal Lahir</label>
                <input type="date" name="birth_date" id="birth_date" value={formData.birth_date} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm" />
            </div>
          </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div>
                <label htmlFor="marital_status" className="block text-sm font-medium text-slate-700">Status Perkawinan</label>
                <select name="marital_status" id="marital_status" value={formData.marital_status} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm">
                    <option>Belum Kawin</option>
                    <option>Kawin</option>
                    <option>Cerai Hidup</option>
                    <option>Cerai Mati</option>
                </select>
            </div>
            <div>
                <label htmlFor="occupation" className="block text-sm font-medium text-slate-700">Pekerjaan</label>
                <input type="text" name="occupation" id="occupation" value={formData.occupation} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm" />
            </div>
           </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="phone_number" className="block text-sm font-medium text-slate-700">Nomor Telpon</label>
              <input type="tel" name="phone_number" id="phone_number" value={formData.phone_number} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm" />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">Email</label>
              <input type="email" name="email" id="email" value={formData.email} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="rt" className="block text-sm font-medium text-slate-700">RT</label>
              <input type="text" name="rt" id="rt" value={formData.rt} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm" />
            </div>
            <div>
              <label htmlFor="rw" className="block text-sm font-medium text-slate-700">RW</label>
              <input type="text" name="rw" id="rw" value={formData.rw} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="dusun" className="block text-sm font-medium text-slate-700">Dusun</label>
              <input type="text" name="dusun" id="dusun" value={formData.dusun} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm" />
            </div>
            <div>
              <label htmlFor="desa" className="block text-sm font-medium text-slate-700">Desa</label>
              <input type="text" name="desa" id="desa" value={formData.desa} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="kecamatan" className="block text-sm font-medium text-slate-700">Kecamatan</label>
              <input type="text" name="kecamatan" id="kecamatan" value={formData.kecamatan} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm" />
            </div>
            <div>
              <label htmlFor="kabupaten" className="block text-sm font-medium text-slate-700">Kabupaten</label>
              <input type="text" name="kabupaten" id="kabupaten" value={formData.kabupaten} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm" />
            </div>
          </div>
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
        <div className="mt-8 pt-6 border-t border-slate-200 flex justify-between items-center">
          <button type="button" onClick={() => navigate('/residents')} className="text-sm font-medium text-slate-600 hover:text-slate-800">
            Batal
          </button>
          <button type="submit" disabled={isSubmitting} className="px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-500 disabled:opacity-50">
            {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </form>
    </div>
  );
}
