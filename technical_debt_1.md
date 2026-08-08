# Technical Debt & Feature Implementation Plan

## Overview
Dokumen ini merangkum kebutuhan pembaruan teknis dan perubahan arsitektur sistem untuk mengakomodasi dua fitur baru pada Sistem Manajemen Invoice:
1. **Fitur 1: Pilihan Rekening Pembayaran di Invoice**
2. **Fitur 2: Penomoran Invoice Manual atau Auto (n+1)**

---

## Backend Implementation Tasks

### 1. Pembaruan Model Invoice
* **File:** `backend/app/models/invoice.py`
* **Status:** Edit
* **Aksi:** Menambahkan kolom `bank_account_id` sebagai *Foreign Key* (FK) yang merujuk ke tabel baru `bank_accounts`. Sebagai alternatif (*fallback*), bisa menggunakan kolom statis (`bank_name`, `bank_account_number`, `bank_account_name`) jika normalisasi ketat tidak diperlukan (namun FK sangat direkomendasikan untuk pengembangan jangka panjang).

### 2. Model Bank Account [BARU]
* **File:** `backend/app/models/bank_account.py`
* **Status:** Baru
* **Aksi:** Membuat file model baru untuk tabel `bank_accounts`.
* **Skema Kolom:** `id`, `bank_name`, `account_number`, `account_name`, `is_active`.

### 3. API Bank Account [BARU]
* **File:** `backend/app/api/v1/bank_accounts.py`
* **Status:** Baru
* **Aksi:** Mengimplementasikan *endpoint* CRUD standar (Create, Read, Update, Delete) untuk manajemen data rekening bank.

### 4. Pembaruan API Invoice
* **File:** `backend/app/api/v1/invoices.py`
* **Status:** Edit
* **Aksi:** 
  * Menambahkan *field* `invoice_number` (bersifat opsional, untuk input manual) ke dalam skema `InvoiceCreate`.
  * Menambahkan *field* `bank_account_id` ke dalam skema `InvoiceCreate` dan `InvoiceUpdate`.
  * Menambahkan *field* representasi detail rekening (`bank_*`) pada skema `InvoiceResponse`.
  * Membuat *endpoint* baru `GET /invoices/next-number` untuk mengambil prediksi nomor invoice otomatis (n+1).

### 5. Pembaruan Service Invoice
* **File:** `backend/app/services/invoice_service.py`
* **Status:** Edit
* **Aksi:** 
  * **Logika Penomoran:** Memodifikasi fungsi `create_invoice()`. Jika `invoice_number` diisi secara manual dari *frontend*, maka gunakan nomor tersebut. Jika kosong, *generate* otomatis dengan rumus n+1 dari invoice terakhir yang ada di sistem (dihitung secara global, bukan *reset* per hari).
  * **Penyimpanan Info Rekening:** Memastikan ID atau informasi rekening yang dipilih tersimpan dengan benar ke entitas *invoice*.

### 6. Refactoring PDF Generator (Material Sale)
* **File:** `backend/app/services/pdf_generator/invoice.py`
* **Status:** Edit
* **Aksi:** Menghapus *hardcoded* info bank pada blok `payment_info` (khususnya di baris 202-208 & 513-519). Mengubah logika agar sistem membaca secara dinamis dari relasi invoice (contoh: `invoice.bank_name`, `invoice.bank_account_number`).

### 7. Pendaftaran Router Utama
* **File:** `backend/app/main.py`
* **Status:** Edit
* **Aksi:** Mendaftarkan *router* untuk `bank_accounts` agar *endpoint* API baru dapat diakses.

### 8. Database Migration [BARU]
* **File:** `backend/alembic/versions/xxx_add_bank_accounts.py`
* **Status:** Baru
* **Aksi:** Membuat file skrip migrasi Alembic untuk mengeksekusi pembuatan tabel `bank_accounts` serta penambahan kolom FK pada tabel `invoices` di level *database*.

---

## Frontend Implementation Tasks

### 9. Pembaruan Komponen InvoiceGenerator
* **File:** `frontend/src/components/InvoiceGenerator.tsx`
* **Status:** Edit
* **Aksi:** 
  * **Step 1 (Form) - Pilihan Rekening:** Menambahkan *dropdown field* yang mengambil data (*fetch*) dari API `/bank-accounts` untuk memilih rekening pembayaran yang aktif.
  * **Step 1 (Form) - Penomoran Invoice:** Menambahkan *input field* atau *toggle* untuk Nomor Invoice. Menyediakan 2 opsi: "Manual" (*input text* bebas) atau "Auto" (sistem menampilkan *preview* nomor urut n+1 dari server).
  * **Integrasi Payload:** Memastikan nilai dari variabel `bank_account_id` dan `invoice_number` (jika *toggle* Manual aktif) terkirim ke dalam parameter (JSON payload) saat sistem menekan tombol simpan/generate API `create_invoice`.

---

## Ringkasan Perubahan

| # | File/Direktori | Aksi | Keterangan |
|---|---|---|---|
| 1 | `backend/app/models/invoice.py` | Edit | Tambah kolom relasi bank pada model |
| 2 | `backend/app/models/bank_account.py` | Baru | Buat model tabel `bank_accounts` |
| 3 | `backend/app/api/v1/bank_accounts.py` | Baru | Buat *endpoint* CRUD rekening bank |
| 4 | `backend/app/api/v1/invoices.py` | Edit | Tambah *field* nomor invoice manual & *bank_account* |
| 5 | `backend/app/services/invoice_service.py` | Edit | Ubah logika penomoran manual/auto (n+1) & simpan data bank |
| 6 | `backend/app/services/pdf_generator/invoice.py` | Edit | Buat `payment_info` PDF dinamis (baris 202-208 & 513-519) |
| 7 | `backend/app/main.py` | Edit | Daftarkan router API `bank_accounts` |
| 8 | `backend/alembic/versions/...` | Baru | Buat skrip migrasi *database* (Alembic) |
| 9 | `frontend/src/components/InvoiceGenerator.tsx` | Edit | Perbarui Form UI: *Dropdown* rekening & opsi nomor invoice |
