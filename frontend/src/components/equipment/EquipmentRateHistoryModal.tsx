import React, { useState } from 'react';
import { X, Calendar, Clock, DollarSign, ArrowRight, Edit2, Trash2, Check, XCircle } from 'lucide-react';
import { useEquipmentRateHistory, useUpdateEquipmentRateHistory, useDeleteEquipmentRateHistory } from '../../hooks/useEquipment';
import { toast } from 'sonner';

interface EquipmentRateHistoryModalProps {
  equipmentId: number | null;
  isOpen: boolean;
  onClose: () => void;
  equipmentName?: string;
}

const EquipmentRateHistoryModal: React.FC<EquipmentRateHistoryModalProps> = ({ equipmentId, isOpen, onClose, equipmentName }) => {
  const { data: history, isLoading } = useEquipmentRateHistory(equipmentId || 0, {
    enabled: isOpen && !!equipmentId
  });

  const updateMutation = useUpdateEquipmentRateHistory();
  const deleteMutation = useDeleteEquipmentRateHistory();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    new_rate: '',
    effective_date: '',
  });

  const handleEditClick = (record: any) => {
    setEditingId(record.id);
    setEditForm({
      new_rate: record.new_rate?.toString() || '',
      effective_date: record.effective_date ? record.effective_date.split('T')[0] : '',
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = async (id: number) => {
    if (!equipmentId) return;
    try {
      await updateMutation.mutateAsync({
        equipmentId,
        historyId: id,
        data: {
          new_rate: Number(editForm.new_rate),
          effective_date: editForm.effective_date ? editForm.effective_date : undefined,
        }
      });
      toast.success('Riwayat harga sewa berhasil diperbarui dan sistem telah melakukan rekalkulasi!');
      setEditingId(null);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Gagal memperbarui riwayat harga sewa');
    }
  };

  const handleDelete = async (id: number) => {
    if (!equipmentId) return;
    if (!window.confirm('Apakah Anda yakin ingin menghapus riwayat harga ini? Sistem akan merevisi ulang seluruh tagihan pemakaian yang terdampak.')) return;
    
    try {
      await deleteMutation.mutateAsync({ equipmentId, historyId: id });
      toast.success('Riwayat harga sewa berhasil dihapus dan sistem telah melakukan rekalkulasi!');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Gagal menghapus riwayat harga sewa');
    }
  };

  if (!isOpen) return null;

  const formatRupiah = (value: number | null) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(value);
  };

  const formatDate = (dateString: string | null, includeTime: boolean = false) => {
    if (!dateString) return '-';
    const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
    if (includeTime) {
      options.hour = '2-digit';
      options.minute = '2-digit';
    }
    return new Intl.DateTimeFormat('id-ID', options).format(new Date(dateString));
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center">
      <div className="relative p-6 border w-full max-w-4xl shadow-lg rounded-xl bg-white max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-gray-900">
            Riwayat Harga Sewa - {equipmentName || 'Alat Berat'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 bg-gray-100 p-2 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-gray-50 rounded-lg p-4 border border-gray-100">
          {isLoading ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : !history || history.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              Belum ada riwayat perubahan harga untuk alat berat ini.
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((record) => (
                <div key={record.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex flex-col sm:flex-row justify-between gap-4">
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0 bg-blue-50 p-3 rounded-full">
                        <DollarSign className="text-blue-600" size={24} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-gray-500 line-through">
                            {formatRupiah(record.old_rate)}
                          </span>
                          <ArrowRight size={14} className="text-gray-400" />
                          <span className="text-lg font-bold text-gray-900">
                            {formatRupiah(record.new_rate)}
                          </span>
                        </div>
                        <div className="text-sm text-gray-500 flex items-center gap-2">
                          <Clock size={14} />
                          Diubah pada: {formatDate(record.created_at, true)}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end justify-center space-y-2">
                      <div className="flex items-center gap-2">
                        {editingId === record.id ? (
                           <div className="flex flex-col items-end gap-2 bg-gray-50 p-3 rounded-lg border">
                             <div>
                               <label className="text-xs text-gray-500 block mb-1">Harga Baru (Rp)</label>
                               <input type="number" className="border rounded px-2 py-1 text-sm w-32" value={editForm.new_rate} onChange={e => setEditForm({...editForm, new_rate: e.target.value})} />
                             </div>
                             <div>
                               <label className="text-xs text-gray-500 block mb-1">Berlaku Sejak</label>
                               <input type="date" className="border rounded px-2 py-1 text-sm w-32" value={editForm.effective_date} onChange={e => setEditForm({...editForm, effective_date: e.target.value})} />
                             </div>
                             <div className="flex gap-2 mt-2">
                               <button onClick={() => handleSaveEdit(record.id)} className="bg-green-600 text-white p-1.5 rounded hover:bg-green-700" disabled={updateMutation.isPending}><Check size={16}/></button>
                               <button onClick={handleCancelEdit} className="bg-gray-200 text-gray-700 p-1.5 rounded hover:bg-gray-300"><XCircle size={16}/></button>
                             </div>
                           </div>
                        ) : (
                          <>
                            {record.trigger_type === 'immediate' && (
                              <span className="px-2.5 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                                Langsung Berlaku
                              </span>
                            )}
                            {record.trigger_type === 'deposit' && (
                              <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full">
                                Antrean Deposit
                              </span>
                            )}
                            {record.trigger_type === 'date' && (
                              <span className="px-2.5 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded-full flex items-center gap-1">
                                <Calendar size={12} />
                                Berlaku sejak: {formatDate(record.effective_date, false)}
                              </span>
                            )}
                            <div className="flex gap-1 ml-2">
                              <button onClick={() => handleEditClick(record)} className="text-blue-600 hover:bg-blue-50 p-1 rounded transition-colors"><Edit2 size={16}/></button>
                              <button onClick={() => handleDelete(record.id)} className="text-red-600 hover:bg-red-50 p-1 rounded transition-colors" disabled={deleteMutation.isPending}><Trash2 size={16}/></button>
                            </div>
                          </>
                        )}
                      </div>
                      
                      {editingId !== record.id && (
                        <div>
                          {record.status === 'applied' ? (
                            <div className="text-sm text-emerald-600 font-medium flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                              Aktif ({record.applied_at ? formatDate(record.applied_at, true) : 'Sekarang'})
                            </div>
                          ) : record.status === 'pending' ? (
                            <div className="text-sm text-amber-600 font-medium flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                              Menunggu...
                            </div>
                          ) : (
                            <div className="text-sm text-red-600 font-medium flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-red-500"></span>
                              Dibatalkan
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EquipmentRateHistoryModal;
