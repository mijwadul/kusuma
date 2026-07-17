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

## Arsitektur Berbasis Divisi (Division-Based Architecture)

Sistem ini mengusung arsitektur **multi-divisi** yang memisahkan konteks data, *dashboard*, dan wewenang pengguna berdasarkan unit kerja, meliputi:
1. **Corporate & Finance**: Pusat administrasi lintas divisi, laporan global, *cash flow*, *payroll*, dan HRD.
2. **Divisi Alat Berat**: Pusat operasional dan pengelolaan manajemen alat berat, *timesheet*, *loading*, dan logistik BBM.
3. **Divisi Trucking & Hauling**: Pusat kontrol mobilitas armada, ritase, vendor *hauling*, dan pengiriman material/surat jalan.
4. **Divisi Material & Lahan**: Pengelolaan manajemen *project*, kepemilikan lahan, dan penjualan material (*material sales*).

Tampilan antarmuka (*dashboard* dan *sidebar*) akan menyesuaikan secara dinamis sesuai dengan divisi yang sedang diakses.

## Hierarki Hak Akses (Roles & Permissions)

Sistem menggunakan kontrol hak akses berikut untuk menjaga batasan fungsionalitas dan persetujuan (approval):

- **`direktur` (Direktur)**: Memiliki hak akses penuh (*read-only*) ke seluruh sistem dan divisi. Bisa melintasi divisi apa saja tanpa batas, tetapi tidak diizinkan untuk menyetujui transaksi (approval) atau memanipulasi data sensitif (tambah/hapus).
- **`gm` (General Manager)**: Otoritas tertinggi. Memiliki *full access*, sanggup berpindah ke divisi mana saja, dan satu-satunya peran (bersama *manager*) yang berhak melakukan persetujuan akhir (*Approve BBM, Approve Payroll*, dsb).
- **`manager` (Manager Divisi)**: Memiliki hak wewenang serupa dengan GM (bisa menyetujui *approval*), **namun dibatasi secara ketat hanya pada divisi tempat ia ditugaskan**.
- **`admin` (Admin/HR)**: Bertanggung jawab atas pengelolaan entitas global (Karyawan, Absensi, Setup *Equipment*).
- **`finance` (Finance Staff)**: Memegang kontrol input terkait Keuangan, *Payroll*, pembuatan Tagihan/Invoice, dan Kas/Vendor.
- **`field` (Field Staff)**: Staf operasional lapangan yang bertugas menginput data mentah harian (Absensi Harian, *Work Logs* Alat Berat, Surat Jalan, dsb) sesuai divisi yang ditugaskan.

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
