# Panduan Integrasi - Detail Penduduk & Kriteria Pengukuran

## 📋 Ringkasan Perubahan

Berikut adalah perubahan yang telah dilakukan pada sistem:

### Backend (Server)

#### Database
- ✅ Tabel `residents` diperluas dengan 8 field baru
- ✅ Tabel `measurement_criteria` baru untuk mengelola kriteria
- ✅ Tabel `resident_criteria_details` baru untuk skor kriteria per penduduk

#### Service Layer
- ✅ `residentService.ts` - Diupdate dengan dukungan field baru
- ✅ `criteriaService.ts` - Service baru untuk kelola kriteria dan skor

#### Routes
- ✅ `routes/criteria.ts` - Routes baru untuk kriteria API
- ✅ `routes/index.ts` - Diupdate untuk menambahkan kriteria routes

### Frontend (Client)

#### Components (Baru)
- ✅ `MeasurementCriteriaManager.tsx` - Kelola kriteria untuk periode
- ✅ `ResidentDetailView.tsx` - Lihat/edit detail lengkap penduduk
- ✅ `ResidentCriteriaManager.tsx` - Kelola skor kriteria per penduduk

#### Pages (Baru)
- ✅ `CriteriaManagementPage.tsx` - Halaman manajemen kriteria
- ✅ `ResidentDetailPage.tsx` - Halaman detail penduduk dengan tab

#### Routes
- ✅ `App.tsx` - Diupdate dengan import dan route baru

---

## 🚀 Cara Menggunakan

### 1. Startup Sistem
```bash
npm run dev
```

Sistem akan otomatis membuat tabel-tabel baru (jika belum ada) saat server dimulai.

### 2. Workflow Dasar

#### Step 1: Buat Periode
1. Login ke dashboard
2. Klik "Buat Periode Baru"
3. Isi informasi periode
4. Simpan

#### Step 2: Kelola Kriteria Pengukuran
1. Dari dashboard, klik periode yang sudah dibuat
2. Klik tab "Kriteria Pengukuran" atau navigasi ke `/period/:periodId/criteria`
3. Klik "+ Tambah Kriteria"
4. Isi:
   - **Nama Kriteria** (misal: "Penghasilan Bulanan")
   - **Deskripsi** (misal: "Semakin rendah penghasilan, semakin tinggi skor")
   - **Skor Min** (misal: 0)
   - **Skor Max** (misal: 100)
   - **Berat** (misal: 2) - Semakin besar, semakin penting
5. Simpan

Ulangi untuk semua kriteria yang ingin digunakan dalam periode ini.

#### Step 3: Input/Kelola Data Penduduk
Anda bisa menambah penduduk melalui:

**Opsi A: Input Manual**
1. Buka halaman "Data Penduduk"
2. Klik "+ Tambah Penduduk"
3. Isi semua detail yang diperlukan
4. Simpan

**Opsi B: Upload Excel**
1. Siapkan file Excel dengan kolom-kolom sesuai dokumentasi
2. Buka halaman "Upload Data"
3. Upload file
4. Verifikasi data
5. Simpan

#### Step 4: Berikan Skor Kriteria per Penduduk
1. Buka halaman "Data Penduduk"
2. Klik nama penduduk atau tombol detail
3. Navigasi ke halaman `/resident/:residentId/detail/:periodId`
   - Atau dari ResidentsPage, buat link ke: `/resident/{id}/detail/{periodId}`
4. Klik tab "Skor Kriteria"
5. Untuk setiap kriteria:
   - Klik "Tambah" di bagian "Tambah Kriteria Lainnya"
   - Atau klik "Edit" pada kriteria yang ada
   - Masukkan skor (harus dalam range min-max)
   - Tambahkan catatan jika perlu
   - Simpan

Sistem akan **otomatis menghitung total skor** berdasarkan skor × berat setiap kriteria.

#### Step 5: Tentukan Penerima Manfaat
1. Berdasarkan skor total yang telah dihitung, tentukan penerima manfaat
2. Gunakan Total Skor sebagai dasar pengambilan keputusan
3. Skor lebih tinggi = prioritas lebih tinggi untuk menerima manfaat

---

## 📊 Contoh Data

### Contoh Kriteria untuk "Bantuan Sosial 2024"

| Nr | Nama Kriteria | Deskripsi | Min | Max | Berat |
|----|---------------|-----------|-----|-----|-------|
| 1 | Penghasilan | Semakin rendah, semakin tinggi skor | 0 | 100 | 3 |
| 2 | Kondisi Rumah | Semakin buruk, semakin tinggi skor | 0 | 100 | 2 |
| 3 | Pendidikan | Semakin rendah, semakin tinggi skor | 0 | 50 | 1 |
| 4 | Jumlah Tanggungan | Semakin banyak, semakin tinggi skor | 0 | 80 | 2 |

### Contoh Skor Penduduk

**Penduduk A:**
- Penghasilan: 80 × 3 = 240
- Kondisi Rumah: 75 × 2 = 150
- Pendidikan: 40 × 1 = 40
- Tanggungan: 60 × 2 = 120
- **TOTAL: 550**

**Penduduk B:**
- Penghasilan: 60 × 3 = 180
- Kondisi Rumah: 85 × 2 = 170
- Pendidikan: 50 × 1 = 50
- Tanggungan: 70 × 2 = 140
- **TOTAL: 540**

→ Penduduk A mendapat prioritas karena skor lebih tinggi

---

## 🔗 API Endpoints

### Residents (Updated)
```
GET    /api/residents
GET    /api/residents/:id
POST   /api/residents
PUT    /api/residents/:id
DELETE /api/residents/:id
POST   /api/residents/bulk
```

### Criteria (New)
```
# Kelola Kriteria
GET    /api/criteria/period/:periodId/criteria
POST   /api/criteria
PUT    /api/criteria/:id
DELETE /api/criteria/:id

# Skor Kriteria
POST   /api/criteria/resident/details
GET    /api/criteria/resident/:residentId/details
GET    /api/criteria/resident/:residentId/score
DELETE /api/criteria/resident-details/:id
GET    /api/criteria/period/:periodId/residents
```

---

## 🗂️ File-File yang Dibuat/Diubah

### Backend
```
server/
├── database.ts                    (Updated)
├── services/
│   ├── residentService.ts        (Updated)
│   └── criteriaService.ts        (New)
└── routes/
    ├── criteria.ts               (New)
    └── index.ts                  (Updated)
```

### Frontend
```
src/
├── App.tsx                        (Updated)
├── components/
│   ├── MeasurementCriteriaManager.tsx (New)
│   ├── ResidentDetailView.tsx          (New)
│   └── ResidentCriteriaManager.tsx     (New)
└── pages/
    ├── CriteriaManagementPage.tsx      (New)
    └── ResidentDetailPage.tsx          (New)
```

---

## ⚙️ Extra: Konfigurasi & Customization

### Menambah Field Baru di Resident

Jika ingin menambah field baru:

1. **Update database.ts:**
   ```sql
   ALTER TABLE residents ADD COLUMN nama_field_baru TEXT;
   ```

2. **Update ResidentInput interface di residentService.ts**

3. **Update ResidentDetailView.tsx dengan input field baru**

### Menambah Kriteria Tipe Berbeda

Kriteria saat ini simple dengan skor numerik. Jika ingin kriteria yang lebih kompleks:

1. Extend `measurement_criteria` table dengan kolom tambahan
2. Update `criteriaService.ts`
3. Update UI components

---

## 🆘 Troubleshooting

### Error: "Table atau column tidak ditemukan"
- Solusi: Restart server agar database terinialisasi ulang
- Check: Pastikan PostgreSQL running dan terkoneksi dengan baik

### Total skor tidak muncul/salah
- Check: Pastikan semua kriteria sudah memiliki skor
- Check: Pastikan berat kriteria sudah diset dengan benar
- Rumus: Total Skor = SUM(skor_kriteria × berat)

### Tidak bisa uplod Excel dengan field baru
- Check: Format kolom sesuai dengan tipe data
- Check: Tanggal gunakan format YYYY-MM-DD
- Check: Kolom required (name, nik) tidak kosong

---

## 📝 Testing Checklist

Sebelum deploy ke production, test:

- [ ] ✅ Bisa membuat periode baru
- [ ] ✅ Bisa menambah kriteria untuk periode
- [ ] ✅ Bisa mengedit kriteria
- [ ] ✅ Bisa menghapus kriteria
- [ ] ✅ Bisa menambah penduduk baru dengan semua field
- [ ] ✅ Bisa mengedit detail penduduk
- [ ] ✅ Bisa menambah skor kriteria untuk penduduk
- [ ] ✅ Total skor otomatis terhitung
- [ ] ✅ Bisa mengedit skor kriteria
- [ ] ✅ Bisa upload Excel dengan field baru
- [ ] ✅ API endpoints semua responsive

---

**Dibuat:** Februari 2026  
**Versi:** 2.0 (Extended)  
**Status:** ✅ Siap Digunakan
