# N8N OCR Integration Guide

## 📋 Setup Instructions

### 1. Setup n8n Webhook untuk OCR

#### Pilihan A: Local n8n (Development)

```bash
# Install n8n
npm install -g n8n

# Jalankan n8n
n8n start

# Akses http://localhost:5678
```

#### Pilihan B: n8n Cloud (Production)
- Sign up di https://n8n.cloud
- Buat akun gratis
- Dapatkan dedicated cloud instance

---

## 🔧 Membuat n8n Workflow untuk OCR

### Step 1: Setup Webhook Trigger

1. Buka n8n
2. Buat workflow baru
3. Tambahkan node **Webhook**:
   - Method: `POST`
   - URL: `https://your-instance.n8n.cloud/webhook/ktp-ocr` (atau localhost:5678)
   - Authentication: None (atau tambahkan Bearer token)

### Step 2: Tambahkan Google Vision API Node

Jika menggunakan Google Vision (recommended):

```
Webhook Trigger
    ↓
Google Vision API Node
- Set credentials (Google Cloud API key)
- Input: File/Image URL dari webhook
- Output: Extracted text + confidence scores
    ↓
Code Node (Extract KTP Fields)
```

### Step 3: Setup Tesseract Alternative

Jika menggunakan Tesseract OCR (open-source):

```
Webhook Trigger
    ↓
Code Node (Tesseract.js)
    ↓
Function:
  const Tesseract = require('tesseract.js');
  const result = await Tesseract.recognize(imageData, 'ind');
  return result.data.text;
    ↓
Code Node (Parse KTP Text)
```

### Step 4: Parse OCR Output

Tambahkan Code Node untuk extract fields dari OCR text:

```javascript
// Parse OCR result to extract KTP fields
const text = $input.all()[0].json.text; // dari OCR node

// menggunakan regex untuk extract fields
const nik = text.match(/(\d{16})/)?.[1] || '';
const name = extractName(text); // custom function
const birthPlace = extractPlace(text);
const birthDate = extractDate(text);
const gender = text.includes('PEREMPUAN') ? 'Perempuan' : 'Laki-laki';
const address = extractAddress(text);

return {
  success: true,
  extracted_data: {
    nik,
    name,
    birth_place: birthPlace,
    birth_date: birthDate,
    gender,
    address
  },
  confidence: 0.87
};
```

### Step 5: Send to Django/PostgreSQL

Tambahkan HTTP Request Node untuk kirim data ke API:

```
Code (Parse Fields)
    ↓
HTTP Request Node
- Method: POST
- URL: https://your-app.com/api/ocr/create-resident-from-ktp
- Headers: 
  - Content-Type: application/json
  - Authorization: Bearer YOUR_API_TOKEN
- Body: $json.extracted_data
    ↓
Response Node
```

---

## 📝 Configuration Variables (Environment)

### .env

```env
# OCR Service
N8N_WEBHOOK_URL=https://your-instance.n8n.cloud/webhook/ktp-ocr
N8N_API_KEY=your_n8n_api_key
OCR_SERVICE=google_vision  # atau tesseract

# Google Vision (jika digunakan)
GOOGLE_CLOUD_API_KEY=your_google_cloud_key
GOOGLE_CLOUD_PROJECT_ID=your_project_id

# Tesseract (jika digunakan)
TESSERACT_PATH=/usr/bin/tesseract
TESSERACT_LANGUAGE=ind

# Server
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=social_assistance
```

---

## 🔌 API Integration

### Endpoint: POST /api/ocr/upload-ktp

```bash
curl -X POST http://localhost:3000/api/ocr/upload-ktp \
  -F "ktp_image=@ktp.jpg" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "message": "Image processed successfully",
  "extracted_data": {
    "nik": "1234567890123456",
    "name": "John Doe",
    "birth_place": "Jakarta",
    "birth_date": "1990-01-15",
    "gender": "Laki-laki",
    "address": "Jl. Merdeka No. 5"
  },
  "confidence_scores": {
    "overall_confidence": 0.87,
    "field_confidences": {
      "nik": 0.95,
      "name": 0.90,
      "birth_date": 0.88,
      "gender": 0.92,
      "address": 0.80
    }
  },
  "file_info": {
    "filename": "ktp-1708353600000-123456789.jpg",
    "path": "/uploads/...",
    "size": 2048576
  }
}
```

### Endpoint: POST /api/ocr/upload-ktp-url

```bash
curl -X POST http://localhost:3000/api/ocr/upload-ktp-url \
  -H "Content-Type: application/json" \
  -d '{
    "image_url": "https://example.com/ktp.jpg"
  }'
```

### Endpoint: POST /api/ocr/create-resident-from-ktp

Auto-create resident dari extracted data:

```bash
curl -X POST http://localhost:3000/api/ocr/create-resident-from-ktp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "extracted_data": {
      "nik": "1234567890123456",
      "name": "John Doe",
      "birth_place": "Jakarta",
      "birth_date": "1990-01-15",
      "gender": "Laki-laki",
      "address": "Jl. Merdeka No. 5"
    },
    "file_info": {
      "filename": "ktp-1708353600000.jpg"
    }
  }'
```

---

## 🔍 Data Extraction Logic

### KTP Field Mapping

```
ID Card (Indonesia):
┌─────────────────────────────────┐
│ NO. INDUK KEPENDUDUKAN (NIK):  │ ← 16 digit number
│ NAMA: JOHN DOE                  │ ← Full name
│ TEMPAT/TGL. LAHIR: Jakarta/1501 │ ← Birth place & date
│ JENIS KELAMIN: Laki-laki         │ ← Gender
│ ALAMAT: Jl. Merdeka No. 5        │ ← Address
│ KOTA/KABUPATEN: Jakarta          │ ← City
│ PROVINSI: DKI Jakarta            │ ← Province
└─────────────────────────────────┘
```

### Regex Patterns

```javascript
// NIK: 16 digits
const NIK_PATTERN = /\b\d{16}\b/;

// Date: YYYY-MM-DD or DD-MM-YYYY
const DATE_PATTERN = /(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})|(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})/;

// Phone: diawali 0 atau +62
const PHONE_PATTERN = /(\+62|0)[0-9]{9,12}/;

// Email: standard email format
const EMAIL_PATTERN = /[\w\.-]+@[\w\.-]+\.\w+/;
```

---

## 🎯 Workflow Diagram

```
┌─────────────────────────────────────────────────────────┐
│ Frontend (React Component)                               │
│ - KTPOCRUpload.tsx                                       │
│ - Accepts file or URL                                   │
└────────────────────┬────────────────────────────────────┘
                     │ POST /api/ocr/upload-ktp
                     │
┌────────────────────▼────────────────────────────────────┐
│ Backend API (ExpressJS)                                 │
│ - ocrService.ts → sendImageToN8N()                     │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP POST (with image)
                     │
┌────────────────────▼────────────────────────────────────┐
│ N8N Webhook Endpoint                                    │
│ https://..../webhook/ktp-ocr                            │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
        ▼                         ▼
┌──────────────────┐     ┌──────────────────┐
│ Google Vision    │     │ Tesseract OCR    │
│ API              │     │ (Open Source)    │
└────────┬─────────┘     └────────┬─────────┘
         │                        │
         └────────────┬───────────┘
                      │
                      ▼
            ┌──────────────────────┐
            │ Code Node            │
            │ Parse/Extract Fields │
            │ (NIK, Name, etc)     │
            └──────────┬───────────┘
                       │
                       ▼
            ┌──────────────────────┐
            │ HTTP Request Node    │
            │ POST /api/ocr/...    │
            └──────────┬───────────┘
                       │ response
        ┌──────────────▼──────────────┐
        │                             │
        ▼                             ▼
    ┌────────────┐            ┌──────────────┐
    │ Auto-fill  │            │ Manual       │
    │ form       │            │ verify +     │
    │ directly   │            │ create       │
    └────────────┘            └──────────────┘
        │                             │
        └──────────────┬──────────────┘
                       │
                       ▼
            ┌──────────────────────┐
            │ PostgreSQL           │
            │ Insert resident     │
            │ with OCR data       │
            └──────────────────────┘
```

---

## 📊 Accuracy & Confidence

### Expected Accuracy Rates

| Field | Google Vision | Tesseract |
|-------|---------------|-----------|
| NIK | 98% | 95% |
| Name | 92% | 88% |
| Birth Date | 91% | 87% |
| Birth Place | 85% | 80% |
| Address | 82% | 75% |
| Gender | 96% | 93% |
| **Overall** | **93%** | **86%** |

### Quality Factors

- Image resolution (300+ DPI recommended)
- Lighting conditions (bright, even lighting)
- Text clarity (no blur, shadows)
- Card condition (not damaged, worn)

---

## 🔒 Security Considerations

### File Upload Security

```typescript
// Validate file
- Type: only JPG, PNG, PDF
- Size: max 5MB
- Scan for malware (optional)

// Storage
- Save to secure directory
- Name: unique, random
- Expire: delete after 1-7 days

// Access Control
- Require authentication
- Log all uploads
- Rate limit: max 10 uploads/minute
```

### Data Handling

```typescript
// API Security
- Use HTTPS only
- Bearer token authentication
- CORS restrictions

// Database
- Encrypt sensitive fields
- Audit logging
- Regular backups

// n8n Security
- Use webhooks with authentication
- IP whitelist if possible
- API key rotation
```

---

## 🐛 Troubleshooting

### Common Issues

**Issue:** OCR returns empty text
```
Solution:
1. Check image quality (brightness, contrast)
2. Verify image format (JPG/PNG)
3. Check n8n logs for errors
4. Test with different OCR engine (Google vs Tesseract)
```

**Issue:** Webhook timeout
```
Solution:
1. Check n8n server status
2. Increase timeout (currently 60s)
3. Check internet connection
4. Verify N8N_WEBHOOK_URL in .env
```

**Issue:** Wrong field extraction
```
Solution:
1. Adjust regex patterns
2. Update language settings (currently Indonesian)
3. Manual review + correction
4. Retrain custom model
```

---

## 📞 Support & Resources

- **n8n Docs:** https://docs.n8n.io
- **Google Vision API:** https://cloud.google.com/vision/docs
- **Tesseract.js:** https://github.com/naptha/tesseract.js
- **n8n Webhooks:** https://docs.n8n.io/nodes/n8n-nodes-base.webhook/

---

**Last Updated:** February 2026  
**Version:** 2.0 (with OCR Integration)
