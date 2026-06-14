import React, { useState } from 'react';

interface OCRUploadProps {
  onSuccess?: (extractedData: any) => void;
  onError?: (error: string) => void;
  autoCreateResident?: boolean;
}

export default function KTPOCRUpload({
  onSuccess,
  onError,
  autoCreateResident = false
}: OCRUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [ocrResult, setOcrResult] = useState<any>(null);
  const [uploadMode, setUploadMode] = useState<'file' | 'url'>('file');
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!validTypes.includes(selectedFile.type)) {
      setError('Hanya file JPG, PNG, atau PDF yang diizinkan');
      return;
    }

    // Validate file size (5MB)
    if (selectedFile.size > 5 * 1024 * 1024) {
      setError('Ukuran file tidak boleh lebih dari 5MB');
      return;
    }

    setFile(selectedFile);
    setError('');

    // Preview image
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleUploadFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Pilih file KTP terlebih dahulu');
      return;
    }

    setLoading(true);
    setProgress(0);
    setError('');

    try {
      const formData = new FormData();
      formData.append('ktp_image', file);

      // Simulasi progress
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch('/api/ocr/upload-ktp', {
        method: 'POST',
        body: formData
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload gagal');
      }

      const data = await response.json();
      setOcrResult(data);

      if (onSuccess) {
        onSuccess(data.extracted_data);
      }

      // Auto create resident jika diaktifkan
      if (autoCreateResident && data.extracted_data) {
        handleCreateResident(data);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan';
      setError(errorMsg);
      if (onError) {
        onError(errorMsg);
      }
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  const handleUploadUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageUrl.trim()) {
      setError('Masukkan URL gambar');
      return;
    }

    setLoading(true);
    setProgress(0);
    setError('');

    try {
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 15, 90));
      }, 200);

      const response = await fetch('/api/ocr/upload-ktp-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: imageUrl })
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Processing gagal');
      }

      const data = await response.json();
      setOcrResult(data);
      setPreviewUrl(imageUrl);

      if (onSuccess) {
        onSuccess(data.extracted_data);
      }

      if (autoCreateResident && data.extracted_data) {
        handleCreateResident(data);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan';
      setError(errorMsg);
      if (onError) {
        onError(errorMsg);
      }
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  const handleCreateResident = async (ocrData: any) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/ocr/create-resident-from-ktp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(ocrData)
      });

      if (!response.ok) {
        throw new Error('Gagal membuat data penduduk');
      }

      const result = await response.json();
      alert('✅ Data penduduk berhasil dibuat otomatis dari KTP');
      
      // Reset form
      setFile(null);
      setImageUrl('');
      setOcrResult(null);
      setPreviewUrl('');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan';
      alert('⚠️ Data terdeteksi, tapi gagal membuat penduduk: ' + errorMsg);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-6 text-gray-900">
        📸 Scan KTP & Auto-Fill Data
      </h2>

      {/* Mode Selection */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setUploadMode('file')}
          className={`flex-1 py-2 px-4 rounded font-medium transition ${
            uploadMode === 'file'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          📤 Upload File
        </button>
        <button
          onClick={() => setUploadMode('url')}
          className={`flex-1 py-2 px-4 rounded font-medium transition ${
            uploadMode === 'url'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          🌐 Upload URL
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          <p className="font-semibold">❌ {error}</p>
        </div>
      )}

      {/* File Upload Form */}
      {uploadMode === 'file' && (
        <form onSubmit={handleUploadFile} className="space-y-4">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <input
              type="file"
              onChange={handleFileChange}
              accept="image/jpeg,image/png,image/jpg,application/pdf"
              disabled={loading}
              className="hidden"
              id="file-input"
            />
            <label
              htmlFor="file-input"
              className="cursor-pointer text-blue-600 hover:text-blue-800 font-medium"
            >
              {file ? (
                <div>
                  <p className="text-lg">✅ {file.name}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-lg">Klik untuk memilih file</p>
                  <p className="text-sm text-gray-500 mt-2">
                    JPG, PNG, atau PDF (Max 5MB)
                  </p>
                </div>
              )}
            </label>
          </div>

          {previewUrl && (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Preview:</p>
              <img
                src={previewUrl}
                alt="KTP Preview"
                className="max-w-full h-64 object-cover rounded border border-gray-300"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={!file || loading}
            className="w-full py-3 px-4 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
          >
            {loading ? '⏳ Processing...' : '🚀 Scan & Extract Data'}
          </button>
        </form>
      )}

      {/* URL Upload Form */}
      {uploadMode === 'url' && (
        <form onSubmit={handleUploadUrl} className="space-y-4">
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://example.com/ktp.jpg"
            disabled={loading}
            className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
          />

          {previewUrl && (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Preview:</p>
              <img
                src={previewUrl}
                alt="KTP Preview"
                className="max-w-full h-64 object-cover rounded border border-gray-300"
                onError={() => setError('Gagal memuat preview gambar')}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={!imageUrl.trim() || loading}
            className="w-full py-3 px-4 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
          >
            {loading ? '⏳ Processing...' : '🚀 Scan URL & Extract Data'}
          </button>
        </form>
      )}

      {/* Progress Bar */}
      {loading && progress > 0 && (
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-sm text-gray-600 mt-2 text-center">{progress}%</p>
        </div>
      )}

      {/* OCR Result */}
      {ocrResult && !loading && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded">
          <h3 className="font-bold text-green-900 mb-4">✅ Data Terdeteksi</h3>

          {/* Confidence Scores */}
          {ocrResult.confidence_scores && (
            <div className="mb-4 p-3 bg-blue-50 rounded">
              <p className="text-sm font-medium text-blue-900">
                Akurasi: {(ocrResult.confidence_scores.overall_confidence * 100).toFixed(0)}%
              </p>
              <div className="text-xs text-blue-700 mt-2 space-y-1">
                {Object.entries(ocrResult.confidence_scores.field_confidences || {}).map(
                  ([field, confidence]: [string, any]) => (
                    <p key={field}>
                      {field}: {(confidence * 100).toFixed(0)}%
                    </p>
                  )
                )}
              </div>
            </div>
          )}

          {/* Extracted Data */}
          <div className="space-y-3">
            {Object.entries(ocrResult.extracted_data || {}).map(([key, value]) => (
              <div key={key} className="flex justify-between text-sm">
                <span className="font-medium text-gray-700">{key}:</span>
                <span className="text-gray-900">{String(value)}</span>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => {
                setOcrResult(null);
                setFile(null);
                setImageUrl('');
                setPreviewUrl('');
              }}
              className="flex-1 py-2 px-4 bg-gray-200 text-gray-900 rounded font-medium hover:bg-gray-300"
            >
              Scan Ulang
            </button>
            {!autoCreateResident && (
              <button
                onClick={() => handleCreateResident(ocrResult)}
                className="flex-1 py-2 px-4 bg-green-600 text-white rounded font-medium hover:bg-green-700"
              >
                💾 Buat Penduduk
              </button>
            )}
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded text-sm text-blue-900">
        <p className="font-semibold">ℹ️ Cara Kerja:</p>
        <ol className="list-decimal list-inside mt-2 space-y-1">
          <li>Upload foto/scan KTP Anda</li>
          <li>Sistem n8n otomatis melakukan OCR (Optical Character Recognition)</li>
          <li>Data terdeteksi ditampilkan untuk verifikasi</li>
          <li>Klik "Buat Penduduk" untuk auto-fill form penduduk baru</li>
        </ol>
      </div>
    </div>
  );
}
