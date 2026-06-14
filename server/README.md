# Server Architecture

Ini adalah dokumentasi struktur backend yang telah di-refactor menjadi modular dan maintainable.

## 📁 Struktur Folder

```
server/
├── index.ts ........................ Entry point aplikasi
├── app.ts .......................... Setup Express app dan middleware
├── database.ts ..................... PostgreSQL connection & initialization
├── middleware/
│   └── auth.ts ..................... JWT authentication middleware
├── routes/
│   ├── index.ts .................... Route aggregator
│   ├── auth.ts ..................... Authentication endpoints
│   ├── periods.ts .................. Period management endpoints
│   ├── residents.ts ................ Resident management endpoints
│   └── beneficiaries.ts ............ Beneficiary management endpoints
├── services/
│   ├── authService.ts ............. Authentication business logic
│   ├── periodService.ts ............ Period business logic
│   ├── residentService.ts .......... Resident business logic
│   └── beneficiaryService.ts ....... Beneficiary business logic
└── utils/
    └── constants.ts ................ Constants & configuration
```

## 🎯 Separation of Concerns

### Entry Point (`index.ts`)
- Memulai aplikasi
- Inisialisasi database
- Start Express server

### App Setup (`app.ts`)
- Konfigurasi Express
- Setup middleware
- Integrasi Vite untuk development

### Database (`database.ts`)
- PostgreSQL connection pool
- Inisialisasi table schema
- Exported untuk digunakan di services

### Middleware (`middleware/auth.ts`)
- JWT token verification
- Conditional authentication untuk public/protected routes

### Services
Berisi business logic yang pure:
- `authService.ts` - Login, register, token verification
- `periodService.ts` - Period CRUD, apply quota
- `residentService.ts` - Resident CRUD, bulk import
- `beneficiaryService.ts` - Beneficiary CRUD, status update

**Keuntungan:**
- Mudah untuk unit test
- Reusable di berbagai tempat
- Tidak tergantung Express

### Routes
Menangani HTTP request/response:
- `auth.ts` - `/register`, `/login`, `/check-auth`, `/logout`, `/debug/users`
- `periods.ts` - `/periods`, `/periods/:id/apply-quota`
- `residents.ts` - `/residents`, `/resident/:id`, bulk import
- `beneficiaries.ts` - `/beneficiaries`, `/beneficiary/:id`, status update

## 🔄 Request Flow

```
HTTP Request
    ↓
Express Middleware (CORS, JSON)
    ↓
Authentication Middleware
    ↓
Route Handler
    ↓
Service (Business Logic)
    ↓
Database (Pool Query)
    ↓
Response
```

## 📝 Menambah Feature Baru

Contoh: Menambah endpoint baru untuk export report

1. **Buat service** (`server/services/reportService.ts`):
```typescript
export async function generateReport(periodId: number) {
  // Business logic
}
```

2. **Buat route** (tambah ke `server/routes/reports.ts`):
```typescript
router.get('/:periodId', async (req, res) => {
  const result = await reportService.generateReport(parseInt(req.params.periodId));
  res.json(result);
});
```

3. **Register route** (di `server/routes/index.ts`):
```typescript
router.use('/reports', reportRoutes);
```

## 🧪 Testing

Karena services tidak dependent Express, mudah untuk test:

```typescript
import { registerUser } from './services/authService';

test('registerUser should hash password', async () => {
  const user = await registerUser('test', 'password123');
  expect(user.username).toBe('test');
});
```

## Environment Variables

Pastikan ada di `.env`:
```
DB_USER=postgres
DB_PASSWORD=password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=social_assistance
JWT_SECRET=your-secret-key
NODE_ENV=development
```

## Scripts

```bash
npm run dev      # Start development server with hot reload
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # TypeScript type checking
```

## Migration dari server.ts

File lama `server.ts` sudah tidak digunakan lagi. Entry point baru adalah `server/index.ts`.

Update di `package.json`:
```json
"dev": "tsx server/index.ts"
```
