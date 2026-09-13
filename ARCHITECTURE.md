# Architecture Documentation - PT. Kusuma Samudera Berkah

Dokumen ini menjelaskan arsitektur sistem, aliran data (*data flow*), hierarki peran (*role & permission*), serta batas-batas layanan (*service boundaries*) dari platform manajemen terpadu PT. Kusuma Samudera Berkah.

---

## 🏛️ 1. System Overview

Sistem dikembangkan menggunakan pola **Monorepo** yang memfasilitasi integrasi antar komponen web admin, backend REST API, dan aplikasi Android mobile.

```mermaid
graph TD
    subgraph Clients
        Web[React SPA / Frontend - Vite + Tailwind]
        Mobile[Android App - Jetpack Compose]
    end

    subgraph API Gateway / Middleware
        FastAPI[FastAPI Backend Framework]
        Auth[JWT Authentication & RBAC Middleware]
    end

    subgraph Service Layer
        MaterialService[Material Sales & Surat Jalan Service]
        EquipmentService[Alat Berat & Work Logs Service]
        FuelService[BBM & Fuel Price Service]
        PayrollService[Payroll & Absensi Service]
        CashflowService[Income, Expenses & Cash Flow Service]
        Scheduler[APScheduler Background Jobs]
    end

    subgraph Data Store
        DB[(Database PostgreSQL / MySQL)]
    end

    Web -->|HTTPS / REST API| FastAPI
    Mobile -->|HTTPS / REST API| FastAPI
    FastAPI --> Auth
    Auth --> MaterialService
    Auth --> EquipmentService
    Auth --> FuelService
    Auth --> PayrollService
    Auth --> CashflowService
    Scheduler --> DB
    MaterialService --> DB
    EquipmentService --> DB
    FuelService --> DB
    PayrollService --> DB
    CashflowService --> DB
```

---

## 🏢 2. Division-Based Architecture

Sistem ini mendukung pengoperasian berorientasi **Multi-Divisi** untuk mengakomodasi unit bisnis PT. Kusuma Samudera Berkah:

```mermaid
flowchart LR
    Portal[Portal Divisi / Context Selector]
    
    Portal --> DivMaterial[Divisi Material]
    Portal --> DivAlatBerat[Divisi Alat Berat]
    Portal --> DivHauling[Divisi Hauling]
    Portal --> DivCorporate[Divisi Corporate / Keuangan]

    DivMaterial --> MS[Penjualan Material & Surat Jalan]
    DivAlatBerat --> EQ[Log Operasional, BBM & Sewa Alat]
    DivHauling --> HL[Rekap ritase & Vendor Hauling]
    DivCorporate --> FN[Income, Expense, Payroll, Cash Flow & Laporan]
```

### Detail Divisi & Akses Fitur:
1. **Divisi Material (`material`)**:
   - Transaksi Penjualan Material (Limestone, Dolomite, Boulder, Clay).
   - Pengelolaan Surat Jalan & Tonase/Timbangan.
   - Manajemen Pelanggan & Armada Truk.
2. **Divisi Alat Berat (`alat-berat`)**:
   - Inventaris Alat Berat (Excavator, Buldozer, Loader, dll.).
   - Log Jam Kerja (*Work Logs*), Konsumsi BBM (*Fuel Logs*), dan Maintenance.
   - Vendor Loading & Penetapan Harga Sewa.
3. **Divisi Hauling (`hauling`)**:
   - Pengelolaan Vendor Transporter & Tarif Ritase.
   - Rekap Surat Jalan Pengangkutan.
4. **Divisi Corporate (`corporate`)**:
   - Konsolidasi Finansial: Pemasukan (*Income*), Pengeluaran (*Expense*), dan *Cash Flow*.
   - Penggajian Pegawai (*Payroll*) & Presensi (*Attendance*).
   - Manajemen User & Log Aktivitas Sistem.

---

## 🔐 3. Role & Permission Hierarchy

Sistem menerapkan **Role-Based Access Control (RBAC)** yang ketat yang disesuaikan dengan tingkat wewenang organisasi:

```mermaid
graph BT
    Field[field / helper] --> Finance[finance / checker]
    Finance --> Manager[manager]
    Manager --> GM[gm / direktur / admin / superuser]
```

### Matriks Akses Peran:

| Peran (Role) | Ruang Lingkup Akses | Akses Divisi | Hak Akses Utama |
| :--- | :--- | :--- | :--- |
| **`gm` / `direktur` / `admin`** | Full System Access | Semua Divisi | Bebas beralih divisi, CRUD seluruh data, manajemen user, pengesahan laporan. |
| **`manager`** | Operational Supervision | Divisi Tertentu / All | Memantau kinerja operasional, verifikasi transaksi & persetujuan biaya. |
| **`finance`** (termasuk *checker*) | Financial & Reconcile | Corporate, Material, Alat Berat | Input & validasi invoice, harga material/BBM, pembayaran & laporan kas. |
| **`field`** (termasuk *helper*) | Field Data Entry | Material, Alat Berat | Input surat jalan, log BBM, dan log jam kerja di lapangan via Web/Android. |

---

## 🔄 4. Data Flow & Transaction Workflows

### 4.1 Flow Transaksi Penjualan Material & Surat Jalan
```mermaid
sequenceDiagram
    autonumber
    actor Checker as Lapangan / Checker
    participant FE as Frontend React
    participant API as FastAPI Backend
    participant DB as Database SQL

    Checker->>FE: Input Form Surat Jalan / Penjualan Material
    FE->>API: POST /api/v1/material-sales
    API->>API: Validasi User Token & Divisi (`material`)
    API->>DB: Simpan Transaksi Penjualan & Surat Jalan
    DB-->>API: Konfirmasi Simpan
    API-->>FE: Return Data Transaksi
    FE-->>Checker: Tampilkan Toast Notifikasi Success & Cetak Nota/PDF
```

### 4.2 Flow Rekapitulasi Kas & Otomatisasi Scheduler
```mermaid
sequenceDiagram
    autonumber
    participant Sch as APScheduler (Backend)
    participant Service as Automation Service
    participant DB as Database SQL

    Sch->>Service: Trigger Daily Midnight Job (00:00 AM)
    Service->>DB: Agregasi Log Jam Kerja & Penggunaan BBM
    Service->>DB: Hitung Efisiensi Operasional Alat Berat
    Service->>DB: Update Summary Cashflow & Rekap Harian
    Service-->>Sch: Job Complete
```

---

## 🛠️ 5. Technology Stack & Boundaries

### Backend Architecture (`/backend`)
- **Framework**: FastAPI (Async Python)
- **ORM**: SQLAlchemy (Declarative Models & Sessions)
- **Authentication**: OAuth2 dengan Password Hashing (Bcrypt) & JWT Bearer Token.
- **Background Tasks**: APScheduler untuk cron job otomatisasi rekap harian & pemeliharaan log.

### Frontend Architecture (`/frontend`)
- **Framework**: React 18 + TypeScript + Vite.
- **State & Data Fetching**: TanStack React Query (Caching, Invalidation, Optimistic Updates).
- **Styling**: Tailwind CSS + Custom CSS Utilities (Glassmorphism & Fluid Typography).
- **Icons & Visuals**: Lucide React + Recharts (Dashboard & Financial Charts).
- **Notification & Modal**: Sonner (Toast System) + Custom Modal Dialogs.

### Mobile Architecture (`/Android`)
- **Framework**: Android Native (Kotlin) dengan Jetpack Compose.
- **API Communication**: Retrofit2 + OkHttp3.

---

**Terakhir Diperbarui:** September 2026  
**Dokumen Pendukung:** [`TECHNICAL_DEBT2.md`]