# Technical Debt & UI/UX Audit - PT. Kusuma Samudera Berkah

Dokumen ini mendokumentasikan *technical debt*, peluang optimasi, serta hasil **Audit Menyeluruh UI/UX Best Practices** untuk sistem manajemen PT. Kusuma Samudera Berkah, diurutkan secara hierarkis dari prioritas **High** hingga **Low**.

**Terakhir Diperbarui:** September 2026  
**Status:** Active Development  
**Maintainer:** [@mijwadul](https://github.com/mijwadul)

---

## 📋 Overview Monorepo

Sistem monorepo ini terdiri dari 3 komponen utama:
- **Backend**: FastAPI (Python 3.10+) + SQLAlchemy + APScheduler
- **Frontend**: React + TypeScript + Vite + Tailwind CSS + React Query
- **Mobile**: Android (Kotlin + Jetpack Compose)

---

## 🎨 SEKSI KHUSUS: REKAPITULASI AUDIT UI/UX

Berdasarkan hasil *codebase scan* pada modul frontend (`frontend/src`), berikut adalah temuan audit UI/UX beserta posisi prioritasnya:

| Area Audit | Masalah Utama | Dampak Pengguna (UX Impact) | Priority Level |
| :--- | :--- | :--- | :--- |
| **1. Accessibility (a11y)** | Dropdown custom (`CustomSelect`, `CustomCombobox`) & Modal (`AlertModal`) belum memiliki atribut ARIA & navigasi keyboard (`ArrowUp/Down`, `Enter`, `Esc`). | Pengguna keyboard & screen reader mengalami hambatan saat pengisian form. | 🔴 **HIGH** |
| **2. Mobile Ergonomics** | Tabel data transaksi terpotong di HP tanpa indikator *horizontal scroll*; ukuran tap target aksi (Edit/Hapus) < 44px. | Checker & tim lapangan (*Field*) kesulitan menekan tombol aksi di layar HP/Tablet. | 🔴 **HIGH** |
| **3. User Feedback & Loading** | Terlalu mengandalkan full-screen spinner universal (`FallbackLoader`); kurangnya *Skeleton Loading* & *Empty States*. | Layar terasa "stuck" dan terjadi *Cumulative Layout Shift* (CLS) saat data dimuat. | 🟠 **MEDIUM** |
| **4. Form Ergonomi & Stepper** | Form modal panjang (15+ field di `MaterialSalesPage`) dalam 1 scroll; validasi bertumpu pada Toast pasca-submit. | Kelelahan kognitif (*form fatigue*) dan kebingungan pengguna ketika submit gagal. | 🟠 **MEDIUM** |
| **5. Design System & Palette** | Penggunaan warna ad-hoc (`bg-blue-600`, `bg-emerald-50`, `glass-panel`) & variasi Dark/Light mode tidak seimbang antara Sidebar & Main Panel. | Visual kurang harmonis saat berpindah modul; risiko kontras warna rendah pada beberapa kartu. | 🟡 **MEDIUM-LOW** |
| **6. Modularisasi Komponen** | `MaterialSalesPage.tsx` berukuran monolithic (> 1.000 baris); modal styling di-duplicate di banyak file. | Kode sulit dipelihara dan rentan regresivitas UI antar modul. | 🟢 **LOW** |

---

## 🔴 HIGH PRIORITY DEBT

### 1. **Accessibility (a11y) & Navigasi Keyboard pada Custom Controls**
- **Komponen**: Frontend (`src/components/CustomSelect.tsx`, `CustomCombobox.tsx`, `AlertModal.tsx`)
- **Masalah**: Kontrol custom tidak mendukung keyboard navigation (`ArrowUp/Down`, `Enter`, `Escape`) dan tidak memiliki atribut WAI-ARIA (`role="combobox"`, `role="listbox"`, `role="dialog"`, `aria-expanded`).
- **Dampak**: Tidak memenuhi standar aksesibilitas web (WCAG 2.1), menyulitkan navigasi pengguna tanpa mouse.
- **Rencana Aksi**:
  - [ ] Tambahkan keyboard event handlers pada `CustomSelect` & `CustomCombobox`.
  - [ ] Tambahkan atribut ARIA yang tepat untuk screen readers.
  - [ ] Implementasikan *focus trap* dan tombol `Escape` pada komponen modal dialog.

### 2. **Mobile Ergonomics & Scroll Indicators pada Data Tables**
- **Komponen**: Frontend (`src/pages/MaterialSalesPage.tsx`, `ProjectSuratJalanPage.tsx`, `IncomePage.tsx`, `index.css`)
- **Masalah**: Tabel dengan banyak kolom terpotong secara horizontal di HP tanpa petunjuk visual (*scroll shadow*), dan tombol ikon aksi (*Edit*, *Delete*) memiliki ukuran area sentuh yang terlalu kecil (< 44px).
- **Dampak**: Pengalaman pengguna mobile/tablet buruk untuk tim lapangan.
- **Rencana Aksi**:
  - [ ] Tambahkan utilitas CSS `scroll-shadows-x` untuk memberi indikator bayangan scroll.
  - [ ] Tingkatkan ukuran tap target tombol aksi menjadi minimum 44px x 44px.
  - [ ] Sediakan tampilan alternatif berbentuk *Mobile Card View* untuk tabel penting di ukuran layar < 640px.

### 3. **Konfigurasi Docker Hilang**
- **Komponen**: Root
- **Masalah**: `docker-compose.yml` dirujuk dalam README tetapi file tidak ada di repositori.
- **Dampak**: Developer/deployer tidak dapat dengan cepat menjalankan *full stack application* secara lokal.
- **Rencana Aksi**:
  - [ ] Buat `docker-compose.yml` (backend, frontend, postgresql/mysql).
  - [ ] Tambahkan contoh konfigurasi `.env`.
  - [ ] Uji jalan stack lengkap menggunakan Docker Compose.

### 4. **Dependency Backend Tanpa Version Locking**
- **Komponen**: Backend (`requirements.txt`)
- **Masalah**: Dependensi utama seperti `fastapi`, `sqlalchemy`, `uvicorn` tidak memiliki batasan versi.
- **Dampak**: Potensi *breaking change* atau ketidakcocokan build antar environment.
- **Rencana Aksi**:
  - [ ] Audit & kunci versi dependensi (misal: `fastapi>=0.100.0,<0.110.0`).
  - [ ] Pisahkan dependensi development ke `requirements-dev.txt`.
  - [ ] Hapus duplikasi `python-multipart` di `requirements.txt`.

### 5. **Outdated Build Tools & Missing CI/CD Pipeline**
- **Komponen**: Frontend & GitHub Actions
- **Masalah**: Belum ada automated testing, linting, atau pipeline CI/CD di GitHub Actions; versi tooling dev perlu diperbarui.
- **Rencana Aksi**:
  - [ ] Buat workflow `.github/workflows/backend-test.yml` & `frontend-test.yml`.
  - [ ] Audit dan perbarui Vite & TypeScript ke versi stabil terbaru.

---

## 🟠 MEDIUM PRIORITY DEBT

### 6. **Skeleton Loading & Empty State UX**
- **Komponen**: Frontend (`src/components/ui/SkeletonTable.tsx`, `EmptyState.tsx`)
- **Masalah**: Saat data dimuat, halaman mengalami lonjakan tata letak (*Layout Shift / CLS*). Ketika data kosong, hanya menampilkan teks polos "Tidak ada data".
- **Rencana Aksi**:
  - [ ] Buat komponen Skeleton Loader untuk tabel dan kartu statistik.
  - [ ] Buat komponen `EmptyState` yang informatif dilengkapi ilustrasi dan tombol Call-To-Action (CTA).

### 7. **Refactoring Form Modal Kompleks (Multi-step Stepper)**
- **Komponen**: Frontend (`src/pages/MaterialSalesPage.tsx`, `EquipmentPage.tsx`)
- **Masalah**: Form modal penjualan material mengandung 15+ input field dalam satu scroll vertikal panjang.
- **Rencana Aksi**:
  - [ ] Restrukturisasi modal panjang menjadi *Multi-Step Form Stepper* (Langkah 1: Info Transaksi -> Langkah 2: Detail Tonase/Volume -> Langkah 3: Pembayaran).
  - [ ] Tambahkan validasi *real-time inline* di bawah masing-masing field input.

### 8. **Pemisahan Mixed Concerns pada Backend (`main.py`)**
- **Komponen**: Backend (`backend/app/main.py`)
- **Masalah**: File `main.py` menggabungkan inisialisasi framework, bootstrap database, pembuatan tabel, setup scheduler, dan pendaftaran 18+ router.
- **Rencana Aksi**:
  - [ ] Ekstrak bootstrap database ke `core/bootstrap.py`.
  - [ ] Ekstrak manajemen lifecycle scheduler ke modul terpisah.
  - [ ] Buat middleware & exception handler tersentralisasi di `core/middleware.py`.

### 9. **Struktur Komponen Layout & Router Refactoring**
- **Komponen**: Frontend (`src/App.tsx`, `src/pages/`)
- **Masalah**: Pengelompokan route di `App.tsx` semakin membengkak (30+ route), dan file page besar seperti `MaterialSalesPage.tsx` (> 1.000 baris) memerlukan modularisasi.
- **Rencana Aksi**:
  - [ ] Pecah halaman monolithic menjadi sub-komponen terpisah di folder komponen terkait.
  - [ ] Rapikan manifes rute ke dalam modul `src/routes/`.

---

## 🟡 MEDIUM-LOW PRIORITY DEBT

### 10. **Design System & Visual Palette Uniformity**
- **Komponen**: Frontend (`src/index.css`, `tailwind.config.js`)
- **Masalah**: Penggunaan warna ad-hoc di berbagai halaman serta inkonsistensi kontras Dark/Light mode antar elemen UI.
- **Rencana Aksi**:
  - [ ] Definisikan token warna terpusat di `tailwind.config.js`.
  - [ ] Selaraskan background panel utama dengan sidebar agar transisi antarmuka lebih smooth.

### 11. **Frontend Linting & Code Style Enforcement**
- **Komponen**: Frontend
- **Masalah**: Tidak ada linter / auto-formatter yang memvalidasi sintaks sebelum commit.
- **Rencana Aksi**:
  - [ ] Install & konfigurasikan ESLint + Prettier di folder `frontend/`.
  - [ ] Tambahkan npm script `lint` dan `format`.

### 12. **Logging Terstruktur pada Backend**
- **Komponen**: Backend (`backend/app/main.py`)
- **Masalah**: Menggunakan `print()` sederhana untuk penanganan exception global.
- **Rencana Aksi**:
  - [ ] Gantikan `print()` dengan library logging terstruktur (`structlog` / `loguru`).

---

## 🟢 LOW PRIORITY DEBT

### 13. **Modularisasi Komponen UI Monolithic**
- **Komponen**: Frontend (`src/pages/MaterialSalesPage.tsx`, `EquipmentPage.tsx`)
- **Masalah**: Penulisan helper, badge, modal, dan tabel berada dalam 1 file besar (> 1.000 baris).
- **Rencana Aksi**:
  - [ ] Ekstrak komponen atomic UI ke `src/components/ui/`.

### 14. **Dokumentasi Lingkungan (.env.example) & Arsitektur Sistem**
- **Komponen**: Root & Backend/Frontend
- **Masalah**: Belum ada file `.env.example` untuk memudahkan dev setup awal. *(Catatan: Dokumentasi `ARCHITECTURE.md` telah selesai dibuat)*.
- **Rencana Aksi**:
  - [x] Buat file [`ARCHITECTURE.md`](file:///d:/Titip/System%20Kusuma/kusuma/ARCHITECTURE.md) yang menjelaskan aliran data 4 divisi utama. (SELESAI)
  - [ ] Buat file `.env.example` pada backend & frontend.

---

## 📊 Summary Rangkuman Technical Debt

| Kategori Prioritas | Jumlah Item | Estimasi Waktu | Komponen Utama |
| :--- | :--- | :--- | :--- |
| 🔴 **HIGH** | 5 Item | 18 - 25 Jam | Accessibility (a11y), Mobile Touch UX, Docker, Backend Dep Locking, CI/CD |
| 🟠 **MEDIUM** | 4 Item | 16 - 24 Jam | Skeleton Loading & Empty State, Multi-step Forms, Refactoring Backend & App.tsx |
| 🟡 **MEDIUM-LOW** | 3 Item | 8 - 12 Jam | Design System Palette, ESLint/Prettier, Structured Logging |
| 🟢 **LOW** | 2 Item | 4 - 8 Jam | Sub-component Extraction, Template `.env.example` |
| **TOTAL** | **14 Item** | **46 - 69 Jam** | *Full Stack (Frontend, Backend, DevOps)* |

---

## 🚀 Langkah Implementasi Direkomendasikan (Roadmap)

1. **Fase 1: Aksesibilitas & Responsive UI (🔴 HIGH)**
   - [ ] Implementasi ARIA roles & keyboard navigation pada `CustomSelect`, `CustomCombobox`, & `Modal`.
   - [ ] Tambahkan *scroll shadows* & optimasi *tap target* mobile (44px) pada tabel data.
   - [ ] Perbaiki versi dependensi backend & buat `docker-compose.yml`.

2. **Fase 2: Visual Polish & User Feedback (🟠 MEDIUM)**
   - [ ] Tambahkan Skeleton Loaders & Empty State Components di seluruh modul utama.
   - [ ] Modularisasi form modal panjang (`MaterialSalesPage`) menjadi Multi-Step Forms.

3. **Fase 3: Code Quality, Clean Architecture & Pipeline (🟡 MED-LOW & 🟢 LOW)**
   - [ ] Konfigurasi ESLint & Prettier pada Frontend.
   - [ ] Refactoring `backend/app/main.py` dan pembuatan CI/CD GitHub Actions.
   - [ ] Implementasi structured logging & pemuatan `.env.example`.

---

**Terakhir Ditinjau:** September 2026  
**Status Audit:** Approved for Implementation
