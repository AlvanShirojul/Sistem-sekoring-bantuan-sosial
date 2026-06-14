# ⚡ QUICK START - Mulai Menggunakan Fitur Baru

Panduan singkat untuk mencoba fitur Detail Penduduk & Kriteria Pengukuran.

---

## 🎯 Goal: Hitung Skor Penduduk Berdasarkan Kriteria

Dalam 5 langkah, Anda akan:
1. Buat Periode
2. Tentukan Kriteria
3. Input Data Penduduk
4. Beri Skor Kriteria
5. Lihat Ranking Berdasarkan Total Skor

---

## 📌 Langkah 1: Startup

```bash
# Terminal
npm run dev
```

Tunggu sampai "✅ Database tables initialized" dan "🚀 Server running"

Buka browser: `http://localhost:5173`

---

## 🔓 Langkah 2: Login

Gunakan credential yang sudah ada (atau register):
- Username: `admin`
- Password: `password`

Akan masuk ke **Dashboard Utama**.

---

## 📅 Langkah 3: Buat Periode Baru

1. Di menu dashboard, cari tombol **"+ Buat Periode"**
2. Isi form:
   - **Nama Periode:** `Bantuan Sosial Desember 2024`
   - **Start Date:** `2024-12-01`
   - **End Date:** `2024-12-31`
   - **Quota:** `100`
3. Klik **"Simpan"**

✅ Periode berhasil dibuat

---

## 📊 Langkah 4: Tambah Kriteria Pengukuran

1. Klik periodo yang baru dibuat
2. Cari dan klik **"Kelola Kriteria"** atau navigasi ke:
   ```
   /period/{periodId}/criteria
   ```
3. Klik **"+ Tambah Kriteria"**

### Kriteria 1: Penghasilan
- **Nama:** `Penghasilan Bulanan`
- **Deskripsi:** `Semakin rendah penghasilan, semakin tinggi skor`
- **Min Score:** `0`
- **Max Score:** `100`
- **Weight:** `3` (penting)
- Klik **Simpan**

### Kriteria 2: Kondisi Rumah
- **Nama:** `Kondisi Rumah`
- **Deskripsi:** `Semakin buruk kondisi, semakin tinggi skor`
- **Min Score:** `0`
- **Max Score:** `100`
- **Weight:** `2`
- Klik **Simpan**

### Kriteria 3: Pendidikan
- **Nama:** `Pendidikan Kepala Keluarga`
- **Deskripsi:** `Semakin rendah pendidikan, semakin tinggi skor`
- **Min Score:** `0`
- **Max Score:** `50`
- **Weight:** `1`
- Klik **Simpan**

✅ Total 3 kriteria sudah dibuat

---

## 👥 Langkah 5: Tambah Data Penduduk

**Opsi A: Manual Input (Cepat, 1 penduduk)**

1. Buka menu **"Data Penduduk"**
2. Klik **"+ Tambah Penduduk"**
3. Isi form dengan data sampel:

```
Nama:               Ahmad Suryanto
NIK:                1234567890123456
No. Kartu Keluarga: 1234567890123456
Jenis Kelamin:      Laki-laki
Tempat Lahir:       Jakarta
Tanggal Lahir:      1985-06-15
No. Telepon:        08123456789
Email:              ahmad@example.com
Pekerjaan:          Tukang Batu
Pendidikan:         SMP
Status Perkawinan:  Menikah
Jumlah Keluarga:    5
Pendapatan Bulanan: 1500000
Tingkat Kemiskinan: Miskin
Alamat:             Jalan Merdeka No. 5, Jakarta
Kondisi Rumah:      Rumah semi permanen, garasi terbatas
```

4. Klik **"Simpan"**

✅ Penduduk berhasil ditambah

**Opsi B: Bulk Upload Excel (Cepat, banyak penduduk)**

1. Siapkan file Excel dengan kolom:
   ```
   name, nik, family_card_no, gender, birth_place, birth_date,
   phone_number, email, occupation, education, marital_status,
   family_size, monthly_income, poverty_level, address, house_conditions
   ```

2. Buka menu **"Upload Data"**
3. Upload file
4. Verifikasi
5. Klik **"Impor"**

✅ Multiple penduduk berhasil ditambah

---

## 🎯 Langkah 6: Berikan Skor Kriteria

1. Dari **"Data Penduduk"** klik nama penduduk atau detail button
2. Atau navigasi ke: 
   ```
   /resident/{residentId}/detail/{periodId}
   ```

3. Klik tab **"Skor Kriteria"**

4. Di bagian "Tambah Kriteria Lainnya", klik **"Tambah"** pada:
   - ✅ Penghasilan Bulanan
   - ✅ Kondisi Rumah
   - ✅ Pendidikan Kepala Keluarga

5. Setiap kriteria akan muncul, klik **"Edit"**:

### Skor untuk Ahmad:

**Penghasilan Bulanan:**
- **Skor:** `90` (Penghasilan rendah)
- **Catatan:** `Hanya kerja sampingan, tidak stabil`
- Klik **Simpan**

**Kondisi Rumah:**
- **Skor:** `85` (Rumah buruk)
- **Catatan:** `Belum layak ditinggali, perlu perbaikan`
- Klik **Simpan**

**Pendidikan Kepala Keluarga:**
- **Skor:** `40` (SMP = pendidikan rendah)
- **Catatan:** `Hanya tamat SMP`
- Klik **Simpan**

✅ Sistem otomatis menghitung:
   - Penghasilan: 90 × 3 = 270
   - Kondisi Rumah: 85 × 2 = 170
   - Pendidikan: 40 × 1 = 40
   - **TOTAL SKOR: 480**

---

## 📈 Langkah 7: Lihat Hasil Perhitungan

Di halaman Skor Kriteria setiap penduduk, Anda akan melihat:

```
┌─────────────────────────────────────────┐
│ Skor Kriteria                           │
│ Total Skor: 480                         │
├─────────────────────────────────────────┤
│ Penghasilan Bulanan: 90 × 3 = 270       │
├─────────────────────────────────────────┤
│ Kondisi Rumah: 85 × 2 = 170             │
├─────────────────────────────────────────┤
│ Pendidikan Kepala Keluarga: 40 × 1 = 40 │
├─────────────────────────────────────────┤
│ Breakdown disimpan dengan catatan       │
└─────────────────────────────────────────┘
```

---

## 🏆 Langkah 8: Verifikasi Data

### Jika ingin ubah detail penduduk:
1. Klik tab **"Detail Penduduk"**
2. Klik **"Edit"**
3. Ubah data yang perlu
4. Klik **"Simpan"**

### Jika ingin ubah skor kriteria:
1. Klik tab **"Skor Kriteria"**
2. Pada kriteria, klik **"Edit"**
3. Ubah skor dan catatan
4. Klik **"Simpan"**

---

## 📊 Ringkasan Data

### Periode "Bantuan Sosial Desember 2024"
- **Kriteria:** 3 kriteria (Penghasilan, Rumah, Pendidikan)
- **Penduduk:** 1 penduduk (Ahmad Suryanto)
- **Total Skor Ahmad:** 480 poin

**Catatan untuk Policy Maker:**
Ahmad memiliki skor cukup tinggi (480/300) yang menunjukkan:
- ✅ Penghasilan sangat rendah
- ✅ Kondisi rumah buruk
- ✅ Pendidikan rendah

**→ Rekomendasi:** Prioritas tinggi untuk menerima bantuan

---

## 🔄 Next Steps

Sekarang Anda bisa:

1. **Tambah lebih banyak penduduk** dengan cara yang sama
2. **Berikan skor setiap penduduk** untuk semua kriteria
3. **Lihat ranking** penduduk berdasarkan total skor
4. **Tentukan penerima manfaat** dengan confidence
5. **Export report** jika diperlukan

---

## 🎓 Tips & Tricks

### 💡 Memberikan Skor yang Objektif

**Panduan Penghasilan:**
- Penghasilan < Rp 1 juta → Skor 80-100
- Penghasilan Rp 1-2 juta → Skor 50-80
- Penghasilan > Rp 2 juta → Skor 20-50

**Panduan Kondisi Rumah:**
- Berlantai tanah, dinding temboknya retak → Skor 80-100
- Semi permanen, ada bocor → Skor 60-80
- Layak, tapi sederhana → Skor 30-60

**Panduan Pendidikan:**
- Tidak sekolah → Skor 50
- SD → Skor 35
- SMP → Skor 25
- SMA → Skor 10
- Diploma/Sarjana → Skor 5

### 📝 Gunakan Catatan

Selalu isi "Catatan" saat memberikan skor:
- Basis pengambilan keputusan
- Audit trail untuk transparansi
- Referensi saat ada pertanyaan

### 🔐 Double-Check

Sebelum finalisasi:
1. Verifikasi semua data penduduk
2. Pastikan skor sesuai kriteria
3. Review catatan untuk setiap skor
4. Konfirmasi total skor sudah benar

---

## 🆘 Common Issues & Solutions

| Problem | Solution |
|---------|----------|
| API error saat simpan | Refresh page, retry |
| Skor tidak muncul | Pastikan kriteria sudah ditambah |
| Total skor 0 | Pastikan semua skor ada |
| Can't edit penduduk | Pastikan sudah login |

---

## ✅ Checklist Selesai

Setelah menyelesaikan quick start ini, Anda sudah:

- [ ] ✅ Startup server
- [ ] ✅ Login ke sistem
- [ ] ✅ Buat 1 periode
- [ ] ✅ Buat 3 kriteria
- [ ] ✅ Input 1 penduduk dengan data lengkap
- [ ] ✅ Berikan skor kriteria lengkap
- [ ] ✅ Lihat total skor otomatis dihitung
- [ ] ✅ Edit data dan skor
- [ ] ✅ Understand cara kerja sistem

**Status:** ✅ **READY FOR PRODUCTION**

---

## 📚 Baca Lebih Lanjut

Untuk informasi lebih detail:
- 📖 [FITUR_BARU.md](./FITUR_BARU.md) - Dokumentasi lengkap
- 🔗 [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) - Panduan integrasi teknis
- 📋 [SUMMARY.md](./SUMMARY.md) - Ringkasan implementation

---

## 🎉 Selesai!

Anda telah berhasil menggunakan fitur baru:
- ✅ Detail Penduduk yang lengkap
- ✅ Sistem Kriteria Pengukuran yang fleksibel

**Sistem ready untuk digunakan dalam proses seleksi penerima manfaat yang lebih akurat dan transparan!**

---

**Quick Start selesai dalam ~15 menit** ⏱️

Butuh lebih banyak guidance? Check dokumentasi atau contact support.

---

Dibuat: February 2026  
Platform: Sistem Skoring Bantuan Sosial v2.0
