# Kusuma Samudera - Management System

Sistem manajemen terintegrasi untuk pengelolaan logistik, inventaris, dan operasional alat berat. Proyek ini terdiri dari tiga komponen utama: Backend (API), Frontend (Web App), dan aplikasi Mobile (Android).

## Struktur Proyek

Repositori ini adalah sebuah _monorepo_ yang menampung seluruh *source code* sistem:

1. **`backend/`**
   - API server yang melayani seluruh permintaan data.
   - Dibangun menggunakan **FastAPI** (Python).
   - Menggunakan database relasional (PostgreSQL/MySQL) dan SQLAlchemy.
2. **`frontend/`**
   - Aplikasi Web (Web App) untuk dashboard admin dan manajemen.
   - Dibangun menggunakan **React** (dengan Vite), TypeScript, dan Tailwind CSS.
3. **`Android/`**
   - Aplikasi Android untuk staf operasional di lapangan.
   - Dibangun menggunakan **Kotlin** dan **Jetpack Compose**.
   - (Detail lebih lanjut dapat dilihat di `Android/README.md`)

## Persyaratan Sistem

- **Node.js** (v18 atau lebih baru) untuk Frontend
- **Python** (v3.10 atau lebih baru) untuk Backend
- **Docker** & **Docker Compose** (Opsional, sangat disarankan untuk _deployment_ atau _testing_ mudah)
- **Android Studio** (untuk pengembangan aplikasi Android)

## Cara Menjalankan Aplikasi (Lokal)

### 1. Menjalankan Backend (FastAPI)
Buka terminal dan arahkan ke folder `backend`:
```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate
# Mac/Linux: source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
Backend API akan berjalan di `http://localhost:8000`.

### 2. Menjalankan Frontend (Web App)
Buka terminal baru dan arahkan ke folder `frontend`:
```bash
cd frontend
npm install
npm run dev
```
Web App akan berjalan di `http://localhost:5173`. Pastikan variabel *environment* di frontend (seperti `VITE_API_BASE_URL`) telah diset ke `http://localhost:8000`.

### 3. Menjalankan via Docker Compose
Jika Anda memiliki Docker terpasang, Anda bisa menjalankan keseluruhan sistem backend dan frontend beserta database dengan satu perintah dari *root folder*:
```bash
docker-compose up -d --build
```

## Pengaturan Git & Keamanan (.gitignore)

Semua komponen dalam proyek ini telah dikonfigurasi melalui `.gitignore` di masing-masing folder agar tidak menyertakan (commit) file yang bersifat sensitif dan *auto-generated*, seperti:
- Kredensial *database* dan kunci rahasia (`.env`).
- File build Android (`.apk`, `build/`, `*.jks`, `google-services.json`).
- Folder instalasi _dependencies_ (`node_modules`, `venv`, `__pycache__`).

Pastikan Anda membuat file konfigurasi `.env` secara manual di server atau komputer lokal Anda saat menjalankan aplikasi ini pertama kali.

## Kontribusi & Manajemen *Technical Debt*

Untuk melihat hal-hal teknis yang masih harus dikerjakan atau dioptimalkan (termasuk potensi *refactoring* dan optimalisasi), silakan lihat file `TECHNICAL_DEBT.md` di direktori utama.
