import React from 'react';
import { X, Calendar, Clock, DollarSign, ArrowRight } from 'lucide-react';
import { useEquipmentRateHistory } from '../../hooks/useEquipment';

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
                      </div>
                      
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
