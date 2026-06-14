import React, { useState } from 'react';
import KTPOCRUpload from '../components/KTPOCRUpload';

interface ExtractedData {
  nik: string;
  name: string;
  birth_place?: string;
  birth_date?: string;
  gender?: string;
  address?: string;
}

export default function OCRUploadPage() {
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

  const handleOCRSuccess = (data: ExtractedData) => {
    setExtractedData(data);
    setSuccessMessage('✅ Data berhasil diekstrak dari KTP');
    setTimeout(() => setSuccessMessage(''), 5000);
  };

  const handleOCRError = (error: string) => {
    console.error('OCR error:', error);
  };

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Scan KTP & Auto-Fill Data Penduduk
          </h1>
          <p className="text-gray-600">
            Gunakan teknologi OCR untuk otomatis mengisi form penduduk dari foto KTP
          </p>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
            {successMessage}
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upload Component */}
          <div className="lg:col-span-2">
            <KTPOCRUpload
              onSuccess={handleOCRSuccess}
              onError={handleOCRError}
              autoCreateResident={false}
            />
          </div>

          {/* Info Sidebar */}
          <div className="space-y-4">
            {/* How It Works */}
            <div className="p-4 bg-white rounded-lg shadow">
              <h3 className="font-bold text-lg mb-3 text-gray-900">Cara Kerja 🤖</h3>
              <ol className="space-y-2 text-sm text-gray-700">
                <li className="flex gap-3">
                  <span className="font-bold text-blue-600">1.</span>
                  <span>Upload foto KTP</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-blue-600">2.</span>
                  <span>n8n + OCR mengekstrak data</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-blue-600">3.</span>
                  <span>Verifikasi data terdeteksi</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-blue-600">4.</span>
                  <span>Auto-fill form atau buat langsung</span>
                </li>
              </ol>
            </div>

            {/* Requirements */}
            <div className="p-4 bg-white rounded-lg shadow">
              <h3 className="font-bold text-lg mb-3 text-gray-900">Persyaratan 📋</h3>
              <ul className="text-sm text-gray-700 space-y-2">
                <li>✅ Format: JPG, PNG, PDF</li>
                <li>✅ Ukuran max: 5MB</li>
                <li>✅ KTP jelas dan terang</li>
                <li>✅ Margin bebas di sekitar</li>
              </ul>
            </div>

            {/* Tech Stack */}
            <div className="p-4 bg-white rounded-lg shadow">
              <h3 className="font-bold text-lg mb-3 text-gray-900">Teknologi 🔧</h3>
              <ul className="text-sm text-gray-700 space-y-2">
                <li>• <strong>n8n</strong> - Workflow automation</li>
                <li>• <strong>Google Vision</strong> - Image processing</li>
                <li>• <strong>Tesseract</strong> - OCR engine</li>
                <li>• <strong>PostgreSQL</strong> - Data storage</li>
              </ul>
            </div>

            {/* Extracted Data Display */}
            {extractedData && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg shadow">
                <h3 className="font-bold text-lg mb-3 text-green-900">Data Terdeteksi ✅</h3>
                <div className="space-y-2 text-sm">
                  <p><strong>NIK:</strong> {extractedData.nik}</p>
                  <p><strong>Nama:</strong> {extractedData.name}</p>
                  {extractedData.birth_place && (
                    <p><strong>TTL:</strong> {extractedData.birth_place}, {extractedData.birth_date}</p>
                  )}
                  {extractedData.gender && (
                    <p><strong>Gender:</strong> {extractedData.gender}</p>
                  )}
                  {extractedData.address && (
                    <p><strong>Alamat:</strong> {extractedData.address.substring(0, 40)}...</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Features Grid */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 bg-white rounded-lg shadow">
            <div className="text-3xl mb-3">⚡</div>
            <h3 className="font-bold text-lg mb-2">Cepat</h3>
            <p className="text-gray-600 text-sm">
              Proses OCR dalam hitungan detik, bukan menit
            </p>
          </div>

          <div className="p-6 bg-white rounded-lg shadow">
            <div className="text-3xl mb-3">🎯</div>
            <h3 className="font-bold text-lg mb-2">Akurat</h3>
            <p className="text-gray-600 text-sm">
              Tingkat akurasi 95%+ dengan confidence scores
            </p>
          </div>

          <div className="p-6 bg-white rounded-lg shadow">
            <div className="text-3xl mb-3">🔄</div>
            <h3 className="font-bold text-lg mb-2">Otomatis</h3>
            <p className="text-gray-600 text-sm">
              Data langsung ke database PostgreSQL tanpa input manual
            </p>
          </div>
        </div>

        {/* Best Practices */}
        <div className="mt-12 p-8 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-bold text-xl mb-4 text-blue-900">💡 Tips untuk Hasil Optimal</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-blue-900">
            <div>
              <p className="font-semibold mb-2">✓ Kondisi Foto</p>
              <ul className="text-sm space-y-1">
                <li>• Pencahayaan terang dan merata</li>
                <li>• KTP penuh dalam frame</li>
                <li>• Tidak blur atau bergoyang</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold mb-2">✓ Posisi & Sudut</p>
              <ul className="text-sm space-y-1">
                <li>• Ambil foto tegak lurus</li>
                <li>• Hindari bayangan atau kilau</li>
                <li>• Margin cukup di sekitar KTP</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
