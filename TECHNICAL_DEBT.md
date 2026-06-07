# Technical Debt & Future Improvements

Dokumen ini berisi daftar hutang teknis (*technical debt*) dan fungsionalitas sisi *server* (Backend) yang harus diimplementasikan atau disempurnakan di masa mendatang untuk mendukung fitur aplikasi Android.

## 1. Sistem Notifikasi Rangkuman Harian (Daily Digest) untuk General Manager (GM)
**Status:** Belum Diimplementasikan di Backend
**Prioritas:** Tinggi

**Deskripsi Masalah:**
Pada Fase 4 aplikasi Android, telah diintegrasikan Firebase Cloud Messaging (FCM) untuk menerima notifikasi. Namun, agar user dengan peran **GM** tidak menerima terlalu banyak *spam* notifikasi setiap kali ada Penjualan Material atau penambahan *Customer* baru, disepakati bahwa pendekatan yang digunakan adalah **Notifikasi Rangkuman Harian (Daily Digest)**.

**Kebutuhan Backend yang Harus Dikerjakan:**
1. **Penyimpanan Token FCM**: Backend harus menyediakan *endpoint* (misal: `POST /api/users/fcm-token`) untuk menerima dan menyimpan `fcm_token` dari aplikasi Android ke tabel `users`.
2. **Cronjob / Background Task (misal: Celery atau APScheduler di FastAPI)**:
   - Buat sebuah *task* terjadwal yang berjalan setiap hari (misal jam 20:00).
   - *Task* ini bertugas untuk menghitung total penjualan material (`MaterialSales`) dan pelanggan baru (`Customers`) yang masuk pada hari tersebut.
   - Jika ada data, buat pesan rangkuman, misalnya: *"Laporan Hari Ini: Terdapat 15 Penjualan Material dan 2 Customer Baru"*.
   - Kirimkan *payload* pesan tersebut via SDK *Firebase Admin* Python (`firebase-admin`) ke daftar `fcm_token` milik *user* dengan role **GM**.
3. **Trigger Event Penting (Opsional)**: Jika ke depannya dibutuhkan persetujuan (*Approval*) darurat yang tidak bisa menunggu rekap sore hari, siapkan *event trigger* agar pesan bisa langsung dikirim seketika.

---
*Catatan: Dokumen ini akan terus diperbarui seiring dengan berjalannya siklus pengembangan sistem Kusuma.*
