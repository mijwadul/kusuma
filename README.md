# 🚢 PT. Kusuma Samudera Berkah - ERP System (Bina-ERP)

**PT. Kusuma Samudera Berkah (Bina-ERP)** adalah sistem manajemen sumber daya perusahaan terintegrasi yang dirancang khusus untuk operasional industri logistik, konstruksi, dan penyewaan alat berat. Sistem ini berfokus pada sinkronisasi data *end-to-end* mulai dari performa SDM (Absensi & Payroll), efisiensi operasional alat berat (BBM & Hour Meter), manajemen material (Surat Jalan & Invoice), hingga pelaporan arus kas (Cash Flow) secara *real-time*.

---

## 🌟 Fitur Utama Sistem

Sistem ini dirancang dengan modul-modul komprehensif yang telah mendukung *Role-Based Access Control* (RBAC) ketat:

### 1. Manajemen SDM & Payroll (HR & Finance)
* **Manajemen Karyawan:** Pendataan karyawan lengkap beserta data bank, kontak darurat, dan informasi finansial (gaji pokok, pinjaman, *deduction*).
* **Absensi (Attendance):** Pencatatan *Check-in* dan *Check-out* berbasis lokasi (Geotagging). Field Staff dapat melakukan input absensi langsung dari lapangan.
* **Perhitungan Gaji (Payroll):** Automasi pembuatan *Slip Gaji* berdasarkan hari hadir, lembur, bonus, dan potongan pinjaman/kasbon. Dilengkapi sistem persetujuan (Approve & Pay) dan ekspor PDF.

### 2. Operasional Alat Berat & Kendaraan (Fleet Management)
* **Manajemen Equipment:** Pelacakan status dan kepemilikan alat berat (Milik Sendiri vs Sewa/Vendor). Mendukung sistem *Deposit* untuk alat sewa.
* **Bahan Bakar (Fuel Management):** Pemantauan harga solar harian, efisiensi konsumsi BBM per unit (Liter/HM), serta sistem *Approval* oleh General Manager untuk setiap pembelian BBM.
* **Log Kerja (Work Logs):** Pencatatan *Hour Meter* (HM) awal/akhir alat berat di setiap proyek untuk dasar tagihan penyewaan.

### 3. Penjualan Material & Proyek (Sales & Projects)
* **Proyek & Pelanggan:** Pengelolaan data proyek yang sedang berjalan beserta status pelanggan/klien.
* **Surat Jalan (Material Sales):** Pembuatan dan pelacakan DO (Delivery Order) / Surat Jalan material tambang/konstruksi, termasuk pengemudi, nopol kendaraan, dan status pengiriman.
* **Manajemen Faktur (Invoicing):** Agregasi otomatis surat jalan menjadi Invoice penagihan kepada pelanggan.

### 4. Keuangan & Arus Kas (Finance & Accounting)
* **Pengeluaran (Expenses):** Pencatatan dan kategorisasi biaya operasional (perbaikan, logistik, dll).
* **Pemasukan Lain-lain (Income Records):** Pemantauan pendapatan tambahan.
* **Laporan Arus Kas (Cash Flow & Reporting):** Laporan neraca laba-rugi (*Profit/Loss*) yang terintegrasi secara dinamis (menggabungkan Penjualan, Pembelian BBM, Payroll, dan Pengeluaran). Tersedia laporan harian dan bulanan dengan visualisasi grafik interaktif.

---

## 🔒 Role-Based Access Control (RBAC)
Sistem memiliki pengelompokan hak akses (Otorisasi) yang sangat ketat:
* **General Manager (GM) / Direktur:** Akses penuh (Superuser), menyetujui anggaran (BBM, Payroll, Pengeluaran), dan melihat *dashboard* finansial.
* **Finance:** Akses ke menu finansial (Invoice, Payroll, Expenses, Vendor Deposit), dan memproses pembayaran.
* **Admin / HR:** Mengelola data Master (Karyawan, Alat Berat, Proyek) tanpa akses ke data nominal/finansial sensitif.
* **Field Staff / Checker:** Akses terbatas hanya untuk operasional lapangan (Input Absensi, Surat Jalan, Log Kerja, Request BBM).

---

## 💻 Tech Stack & Arsitektur

Aplikasi ini menggunakan arsitektur modern yang 100% *Type-Safe*, reaktif, dan skalabel:

### Frontend
* **Core:** [React.js](https://react.dev/) dengan [TypeScript](https://www.typescriptlang.org/)
* **Build Tool:** [Vite](https://vitejs.dev/)
* **Styling & UI:** [Tailwind CSS](https://tailwindcss.com/) + [Lucide React](https://lucide.dev/) (Icons)
* **Data Fetching & Caching:** [TanStack Query (React Query)](https://tanstack.com/query/v5) + Axios
* **Routing:** React Router DOM

### Backend
* **Core:** [FastAPI (Python 3.13)](https://fastapi.tiangolo.com/) (Asynchronous API)
* **ORM:** [SQLAlchemy](https://www.sqlalchemy.org/)
* **Validasi:** Pydantic
* **Database:** [PostgreSQL](https://www.postgresql.org/) (Production) / SQLite (Development)
* **Autentikasi:** JWT (JSON Web Tokens) dengan Hashing Kata Sandi modern (Bcrypt).
* **Generator Laporan:** ReportLab (Untuk Ekspor PDF Slip Gaji & Invoice)

---

## 🚀 Memulai (Getting Started)

### Prasyarat
Sebelum memulai, pastikan Anda telah menginstal:
* Python 3.13 atau versi terbaru.
* Node.js (LTS Version, mis. 20.x ke atas).
* PostgreSQL (Atau Docker untuk menjalankan database).

### 1. Setup Backend (FastAPI)
```bash
cd backend

# Buat virtual environment
python -m venv venv

# Aktifkan venv
source venv/bin/activate  # Mac/Linux
.\venv\Scripts\activate   # Windows

# Instal dependensi
pip install -r requirements.txt

# Menjalankan server (Secara default akan berjalan di port 8000)
uvicorn app.main:app --reload --port 8000
```
> **Catatan:** Pada saat pertama kali server dijalankan, aplikasi akan melakukan migrasi *database* (SQLite/PostgreSQL bergantung pada konfigurasi `DATABASE_URL` di `.env`) dan membuatkan akun admin bawaan (`admin@kusuma.com`).

### 2. Setup Frontend (React + Vite)
```bash
cd frontend

# Instal dependensi (Gunakan legacy-peer-deps jika ada konflik plugin)
npm install --legacy-peer-deps

# Jalankan server pengembangan Vite
npm run dev
```
> Aplikasi *frontend* akan dapat diakses secara lokal melalui `http://localhost:5173`. Pastikan variabel `VITE_API_URL` (atau konfigurasi di `apiClient.ts`) mengarah tepat ke `http://localhost:8000/api/v1`.

---

## 📂 Struktur Direktori Utama
```
kusuma/
├── backend/
│   ├── app/
│   │   ├── api/v1/         # Endpoint/Routes API (Auth, Dashboard, Payroll, dsb)
│   │   ├── core/           # Konfigurasi sistem, keamanan (JWT), exception handler
│   │   ├── models/         # Definisi model tabel Database (SQLAlchemy)
│   │   ├── schemas/        # Validasi I/O (Pydantic Models)
│   │   └── services/       # Logika bisnis terpisah (Pembuatan PDF, Kalkulasi Finansial)
│   └── main.py             # Entry point FastAPI
└── frontend/
    ├── src/
    │   ├── api/            # API Client (Axios interceptor) & pemanggilan autentikasi
    │   ├── components/     # Komponen UI Reusable (Modal, Sidebar, Kartu Statistik)
    │   ├── hooks/          # React Query Custom Hooks (Pembungkus API Calls)
    │   ├── pages/          # Komponen Level Halaman (.tsx) 
    │   └── utils/          # Fungsi Utilitas (Format IDR, Tanggal)
    ├── vite.config.ts      # Konfigurasi Vite
    └── tailwind.config.js  # Konfigurasi Tailwind & Warna Tema
```

---
*© 2026 PT. Kusuma Samudera Group. ERP System Documentation.*