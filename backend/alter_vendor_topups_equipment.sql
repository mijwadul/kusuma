-- ============================================================
-- Migration: Tambah kolom equipment_id ke tabel vendor_topups
-- Jalankan script ini di MySQL client atau phpMyAdmin
-- ============================================================

-- Cek dan tambah kolom equipment_id (nullable, FK ke equipment.id)
ALTER TABLE vendor_topups 
  ADD COLUMN IF NOT EXISTS equipment_id INT NULL AFTER vendor_id;

-- Tambah foreign key (opsional, abaikan jika error)
ALTER TABLE vendor_topups
  ADD CONSTRAINT fk_vendor_topups_equipment 
  FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE SET NULL;

-- Verifikasi
DESCRIBE vendor_topups;
