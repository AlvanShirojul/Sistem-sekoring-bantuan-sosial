# Dokumentasi Fitur Baru: Detail Penduduk & Kriteria Pengukuran

## Ringkasan Fitur

Sistem telah diperbarui dengan fitur-fitur berikut:

1. **Detail Penduduk yang Lebih Lengkap** - Informasi penduduk lebih komprehensif
2. **Kriteria Pengukuran Fleksibel** - Kelola kriteria untuk setiap periode
3. **Skor Berdasarkan Kriteria** - Hitung skor penduduk berdasarkan kriteria yang ditentukan

---

## I. Detail Penduduk (Enhanced Resident Information)

### Data yang Tersimpan

Sistem sekarang menyimpan informasi penduduk berikut:

#### Informasi Dasar
- Nama (required)
- NIK (required, unique)
- Nomor Kartu Keluarga
- Jenis Kelamin (Laki-laki/Perempuan)

#### Informasi Kelahiran
- Tempat Lahir
- Tanggal Lahir

#### Informasi Kontak
- Nomor Telepon
- Email

#### Informasi Pekerjaan & Pendidikan
- Pekerjaan
- Pendidikan (Tidak Sekolah, SD, SMP, SMA, Diploma, Sarjana)

#### Informasi Keluarga
- Status Perkawinan (Belum Menikah, Menikah, Cerai Hidup, Cerai Mati)
- Jumlah Keluarga

#### Informasi Finansial & Perumahan
- Pendapatan Bulanan
- Tingkat Kemiskinan (Sangat Miskin, Miskin, Hampir Miskin, Tidak Miskin)
- Alamat
- Kondisi Rumah

### Cara Menggunakan

#### Menambah Penduduk Baru
1. Navigasi ke halaman "Data Penduduk"
2. Klik tombol "+ Tambah Penduduk"
3. Isi semua data yang diperlukan
4. Klik "Simpan"

#### Mengedit Detail Penduduk
1. Buka halaman detail penduduk
2. Klik tombol "Edit" di tab "Detail Penduduk"
3. Ubah data yang diperlukan
4. Klik "Simpan"

#### Import Excel dengan Data Lengkap
Anda dapat menggunakan template Excel dengan kolom-kolom berikut:

| Kolom | Nama Alternatif | Tipe |
|-------|-----------------|------|
| name | nama | String (required) |
| nik | nik | String (required, unique) |
| family_card_no | nomor_kartu_keluarga | String |
| gender | jenis_kelamin | String |
| birth_place | tempat_lahir | String |
| birth_date | tanggal_lahir | Date (YYYY-MM-DD) |
| marital_status | status_perkawinan | String |
| occupation | pekerjaan | String |
| phone_number | nomor_telepon | String |
| email | email | String |
| monthly_income | pendapatan_bulanan | Number |
| poverty_level | tingkat_kemiskinan | String |
| house_conditions | kondisi_rumah | String |
| education | pendidikan | String |
| family_size | jumlah_keluarga | Number |
| address | alamat | String |

---

## II. Kriteria Pengukuran (Measurement Criteria)

### Konsep

Kriteria Pengukuran memungkinkan Anda mendefinisikan parameter yang digunakan untuk menghitung skor penduduk. Setiap periode dapat memiliki kriteria yang berbeda-beda.

### Komponen Kriteria

1. **Nama Kriteria** - Identifier unik untuk kriteria (contoh: "Penghasilan", "Kondisi Rumah")
2. **Deskripsi** - Penjelasan detail tentang kriteria
3. **Skor Minimum** - Nilai skor terendah yang bisa diberikan
4. **Skor Maksimum** - Nilai skor tertinggi yang bisa diberikan
5. **Berat (Weight)** - Multiplier untuk menghitung kontribusi kriteria pada skor total

### Contoh Penggunaan

**Skenario:** Periode "Bantuan Sosial 2024"

Kriteria yang didefinisikan:

| Kriteria | Min | Max | Berat | Keterangan |
|----------|-----|-----|-------|-----------|
| Penghasilan Bulanan | 0 | 100 | 2 | Semakin rendah penghasilan, semakin tinggi skor |
| Kondisi Rumah | 0 | 100 | 3 | Semakin buruk kondisi rumah, semakin tinggi skor |
| Pendidikan Kepala Keluarga | 0 | 50 | 1 | Semakin rendah pendidikan, semakin tinggi skor |
| Jumlah Tanggungan | 0 | 80 | 2 | Semakin banyak tanggungan, semakin tinggi skor |

**Cara Menghitung Total Skor:**
Total Skor = (Skor Penghasilan × 2) + (Skor Kondisi Rumah × 3) + (Skor Pendidikan × 1) + (Skor Tanggungan × 2)

### Cara Menggunakan

#### Menambah Kriteria Baru
1. Buka halaman periode
2. Klik tab "Kriteria Pengukuran"
3. Klik "+ Tambah Kriteria"
4. Isi data:
   - Nama Kriteria (required)
   - Deskripsi (optional)
   - Skor Minimum (required)
   - Skor Maksimum (required)
   - Berat (default: 1)
5. Klik "Simpan"

#### Mengedit Kriteria
1. Klik tombol "Edit" pada baris kriteria yang ingin diubah
2. Ubah data yang diperlukan
3. Klik "Perbarui"

#### Menghapus Kriteria
1. Klik tombol "Hapus" pada baris kriteria
2. Konfirmasi penghapusan

---

## III. Skor Berdasarkan Kriteria

### Cara Kerja

Untuk setiap penduduk, Anda memberikan skor untuk setiap kriteria yang telah didefinisikan. Sistem akan secara otomatis menghitung total skor berdasarkan bobot setiap kriteria.

### Cara Menggunakan

#### Memberikan Skor untuk Penduduk
1. Buka halaman detail penduduk
2. Klik tab "Skor Kriteria"
3. Sistem akan menampilkan:
   - Daftar kriteria yang telah memiliki skor
   - Daftar kriteria yang belum memiliki skor
   - Total skor saat ini

#### Menambah Skor Kriteria
Jika belum ada skor untuk suatu kriteria:
1. Scroll ke bagian "Tambah Kriteria Lainnya"
2. Klik "Tambah" pada kriteria yang ingin dinilai
3. Sistem akan membuat entry baru

#### Mengubah/Mengedit Skor
1. Pada kriteria yang sudah memiliki skor, klik "Edit"
2. Ubah skor (harus berada dalam range min-max)
3. Tambahkan catatan jika diperlukan (optional)
4. Klik "Simpan"

#### Menghapus Skor
1. Pada kriteria yang ingin dihapus, klik "Hapus"
2. Skor akan dihapus (tapi kriteria masih bisa ditambahkan kembali)

### Contoh Perhitungan Skor

**Penduduk: Ahmad Suryanto**
**Periode: Bantuan Sosial 2024**

| Kriteria | Skor | Berat | Poin (Skor × Berat) |
|----------|------|-------|---------------------|
| Penghasilan Bulanan | 80 | 2 | 160 |
| Kondisi Rumah | 75 | 3 | 225 |
| Pendidikan Kepala Keluarga | 40 | 1 | 40 |
| Jumlah Tanggungan | 60 | 2 | 120 |
| **TOTAL** | | | **545** |

---

## IV. API Endpoints

### Resident Endpoints (Updated)

```
GET /api/residents
GET /api/residents/:id
POST /api/residents
PUT /api/residents/:id
DELETE /api/residents/:id
POST /api/residents/bulk
```

### Measurement Criteria Endpoints (New)

```
# Kelola Kriteria
GET /api/criteria/period/:periodId/criteria - Dapatkan semua kriteria untuk periode
GET /api/criteria/:id - Dapatkan detail kriteria
POST /api/criteria - Tambah kriteria baru
PUT /api/criteria/:id - Update kriteria
DELETE /api/criteria/:id - Hapus kriteria

# Skor Kriteria Penduduk
POST /api/criteria/resident/details - Tambah/update skor kriteria untuk penduduk
GET /api/criteria/resident/:residentId/details - Dapatkan skor kriteria penduduk
GET /api/criteria/resident/:residentId/score - Dapatkan total skor penduduk
DELETE /api/criteria/resident-details/:id - Hapus skor kriteria
GET /api/criteria/period/:periodId/residents - Dapatkan semua penduduk dengan skor mereka
```

---

## V. Struktur Database

### Tabel `residents` (Updated)
```sql
CREATE TABLE residents (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  nik TEXT UNIQUE,
  family_card_no TEXT,
  address TEXT,
  birth_place TEXT,
  birth_date TEXT,
  gender TEXT,
  marital_status TEXT,
  occupation TEXT,
  phone_number TEXT,
  email TEXT,
  monthly_income DECIMAL,
  poverty_level TEXT,
  house_conditions TEXT,
  education TEXT,
  family_size INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Tabel `measurement_criteria` (New)
```sql
CREATE TABLE measurement_criteria (
  id SERIAL PRIMARY KEY,
  period_id INTEGER NOT NULL REFERENCES periods(id),
  name TEXT NOT NULL,
  description TEXT,
  min_score INTEGER,
  max_score INTEGER,
  weight INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(period_id, name)
);
```

### Tabel `resident_criteria_details` (New)
```sql
CREATE TABLE resident_criteria_details (
  id SERIAL PRIMARY KEY,
  resident_id INTEGER NOT NULL REFERENCES residents(id),
  criteria_id INTEGER NOT NULL REFERENCES measurement_criteria(id),
  score INTEGER,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(resident_id, criteria_id)
);
```

---

## VI. Best Practices

### Merancang Kriteria yang Baik

1. **Spesifik** - Nama dan deskripsi jelas dan tidak ambigu
2. **Terukur** - Skor harus dapat diukur secara objektif
3. **Relevan** - Kriteria relevan dengan tujuan periode
4. **Konsisten** - Gunakan skala yang konsisten
5. **Berbobot** - Sesuaikan bobot dengan pentingnya kriteria

### Pemberian Skor

1. **Objektif** - Berikan skor berdasarkan fakta, bukan subjektivitas
2. **Dokumentasi** - Gunakan field "catatan" untuk menjelaskan skor
3. **Konsistensi** - Terapkan standar yang sama untuk semua penduduk
4. **Verifikasi** - Verifikasi data sebelum memberikan skor akhir

---

## VII. Troubleshooting

### Skor tidak muncul
- Pastikan kriteria sudah ditambahkan untuk periode
- Pastikan skor sudah disimpan untuk penduduk

### Error saat mengimpor Excel
- Periksa format kolom (khususnya tanggal dalam format YYYY-MM-DD)
- Pastikan NIK unik (tidak ada duplikat)
- Pastikan kolom required (name, nik) tidak kosong

### Tidak bisa menambah kriteria untuk periode
- Pastikan periode sudah dibuat
- Pastikan nama kriteria belum ada untuk periode ini

---

## VIII. Screenshots/UI Components

### Component yang Dibuat

1. **MeasurementCriteriaManager** - Mengelola kriteria untuk suatu periode
2. **ResidentDetailView** - Melihat dan mengedit detail lengkap penduduk
3. **ResidentCriteriaManager** - Mengelola skor kriteria untuk seorang penduduk

### Pages yang Dibuat

1. **CriteriaManagementPage** - Halaman kelola kriteria untuk period
2. **ResidentDetailPage** - Halaman detail penduduk dengan tab untuk detail dan skor kriteria

---

## IX. Update Summary

### Backend Changes
- ✅ Updated `residents` table schema
- ✅ Added `measurement_criteria` table
- ✅ Added `resident_criteria_details` table
- ✅ Updated `residentService.ts` with new fields
- ✅ Created `criteriaService.ts` with complete CRUD operations
- ✅ Created `criteria.ts` routes
- ✅ Updated routes index to include criteria routes

### Frontend Changes
- ✅ Created `MeasurementCriteriaManager.tsx` component
- ✅ Created `ResidentDetailView.tsx` component
- ✅ Created `ResidentCriteriaManager.tsx` component
- ✅ Created `CriteriaManagementPage.tsx` page
- ✅ Created `ResidentDetailPage.tsx` page

### Database Schema Changes
- ✅ Extended `residents` table with 8 new columns
- ✅ Created `measurement_criteria` table
- ✅ Created `resident_criteria_details` table

---

## X. Next Steps

Untuk menggunakan fitur baru ini:

1. **Deploy/Restart Server**
   ```bash
   npm run dev
   ```

2. **Akses Interface**
   - Buat periode baru
   - Kelola kriteria untuk periode
   - Lihat/edit detail penduduk
   - Berikan skor kriteria untuk setiap penduduk

3. **Monitor Skor**
   - Skor otomatis dihitung dari bobot
   - Lihat Total Skor di halaman setiap penduduk
   - Gunakan skor untuk menentukan penerima manfaat yang tepat

---

**Dokumentasi Dibuat:** Februari 2026
**Versi Sistem:** 2.0 (dengan Kriteria Pengukuran)
