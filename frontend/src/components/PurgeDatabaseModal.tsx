import React, { useState } from 'react';
import { ShieldAlert, Trash2, X, Loader2, Lock, AlertTriangle, CheckCircle2, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '../api/apiClient';

interface PurgeDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const PurgeDatabaseModal: React.FC<PurgeDatabaseModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  if (!isOpen) return null;

  const confirmOptions = [
    { value: '', label: '-- Pilih opsi combobox untuk verifikasi --' },
    { value: 'cancel', label: '❌ Batalkan operasi ini (Jangan hapus data)' },
    { value: 'keep', label: '🛡️ Saya masih memerlukan data operasional' },
    { value: 'PURGE_CONFIRMED', label: '⚠️ SAYA YAKIN & SETUJU: KOSONGKAN SELURUH ISI DATABASE' },
  ];

  const isConfirmed = selectedAction === 'PURGE_CONFIRMED';

  const handleExecutePurge = async () => {
    if (!isConfirmed) {
      toast.error('Silakan pilih opsi konfirmasi persetujuan terlebih dahulu pada combobox.');
      return;
    }

    setLoading(true);
    const loadingToast = toast.loading('Sedang membersihkan seluruh data operasional database...');

    try {
      const response = await apiClient.post('/system/purge-database', {
        confirmation: selectedAction,
        password: password.trim() ? password : null,
      });

      toast.success(response.data.message || 'Database berhasil dikosongkan! Kredensial login tetap aman.', {
        id: loadingToast,
        duration: 6000,
      });

      setSelectedAction('');
      setPassword('');
      onClose();

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error(err);
      toast.error(
        err.response?.data?.detail || err.message || 'Gagal melakukan pembersihan database.',
        { id: loadingToast }
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-rose-500/40 rounded-2xl shadow-2xl shadow-rose-950/50 w-full max-w-lg overflow-hidden flex flex-col my-8">
        {/* Header Alert */}
        <div className="bg-gradient-to-r from-rose-950/80 to-slate-900 px-6 py-5 border-b border-rose-500/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-600/30 border border-rose-500/50 text-rose-400 rounded-xl">
              <ShieldAlert size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
                Pembersihan Total Database
              </h2>
              <p className="text-xs text-rose-300/80">Operasi kritis penghapusan data operasional (Khusus Otoritas GM)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 text-slate-300 text-sm">
          {/* Warning Banner */}
          <div className="bg-rose-950/40 border border-rose-500/30 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1.5 text-xs leading-relaxed">
              <p className="font-semibold text-rose-200 text-sm">Tindakan ini bersifat Permanen!</p>
              <p className="text-rose-300/90">
                Semua data proyek, transaksi, surat jalan, invoice, hauling, data alat berat, BBM, vendor,
                gaji, dan kasbon akan <b>dihapus secara permanen</b>.
              </p>
              <p className="text-emerald-400 font-medium pt-1 flex items-center gap-1.5">
                <CheckCircle2 size={14} className="shrink-0" />
                Seluruh akun &amp; kredensial login (User Login) tetap <b>100% AMAN</b> dan tidak dihapus.
              </p>
            </div>
          </div>

          {/* Combobox Konfirmasi */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="purge-confirmation-select" className="text-xs font-semibold text-slate-300">
                Combobox Verifikasi Konfirmasi <span className="text-rose-400">*</span>
              </label>
              {isConfirmed ? (
                <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1 bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded-md">
                  <CheckCircle2 size={12} />
                  Kunci Terbuka (Disetujui)
                </span>
              ) : (
                <span className="text-[11px] text-amber-400/90 font-medium bg-amber-950/40 border border-amber-500/30 px-2 py-0.5 rounded-md">
                  Terkunci (Belum disetujui)
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mb-2">
              Pilih opsi persetujuan di combobox berikut untuk membuka kunci tombol eksekusi purge:
            </p>
            <div className="relative">
              <select
                id="purge-confirmation-select"
                value={selectedAction}
                onChange={(e) => setSelectedAction(e.target.value)}
                className={`w-full appearance-none rounded-xl px-4 py-3 text-sm font-medium transition-all cursor-pointer focus:outline-none focus:ring-2 pr-10 ${
                  isConfirmed
                    ? 'bg-rose-950/50 border-2 border-rose-500 text-rose-200 focus:ring-rose-500 shadow-lg shadow-rose-950/50'
                    : 'bg-slate-800/90 border border-slate-700 text-slate-200 hover:border-slate-600 focus:ring-rose-500'
                }`}
              >
                {confirmOptions.map((opt) => (
                  <option
                    key={opt.value}
                    value={opt.value}
                    className="bg-slate-900 text-slate-200 py-2"
                  >
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-400">
                <ChevronDown size={18} />
              </div>
            </div>
          </div>

          {/* Password Verifikasi Akun */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Lock size={13} className="text-slate-400" />
              Password Akun Login Anda <span className="text-xs text-slate-400 font-normal">(opsional)</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Masukkan password akun jika ingin validasi ganda..."
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-rose-500 placeholder-slate-500 transition-all"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-950/60 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-sm font-medium transition-colors"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleExecutePurge}
            disabled={!isConfirmed || loading}
            className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-lg ${
              isConfirmed && !loading
                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-900/50 cursor-pointer animate-pulse'
                : 'bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed opacity-60'
            }`}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Memproses Purge...</span>
              </>
            ) : (
              <>
                <Trash2 size={16} />
                <span>Eksekusi Purge Database</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PurgeDatabaseModal;
