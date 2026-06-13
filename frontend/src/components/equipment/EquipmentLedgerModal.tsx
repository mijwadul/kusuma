import React from 'react';
import { X, ArrowDownRight, ArrowUpRight, Info, Activity, Clock, Download } from 'lucide-react';
import { useEquipmentLedger, Equipment } from '../../hooks/useEquipment';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';

interface EquipmentLedgerModalProps {
  equipment: Equipment | null;
  isOpen: boolean;
  onClose: () => void;
}

const EquipmentLedgerModal: React.FC<EquipmentLedgerModalProps> = ({
  equipment,
  isOpen,
  onClose,
}) => {
  const { data: ledger, isLoading, error } = useEquipmentLedger(equipment?.id as number, {
    enabled: !!equipment?.id && isOpen,
  });

  if (!isOpen) return null;

  const formatRupiah = (value: number | null) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(value);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(new Date(dateString));
  };

  const handleDownloadPdf = async () => {
    if (!ledger || ledger.length === 0 || !equipment) {
      toast.error('Tidak ada data ledger untuk diunduh');
      return;
    }

    const doc = new jsPDF();
    
    // Load Logo
    try {
      const img = new Image();
      img.src = "/logo.png";
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      // Add logo (x: 14, y: 10, width: 25, height: 25)
      doc.addImage(img, "PNG", 14, 10, 25, 25);
    } catch (e) {
      console.warn("Failed to load logo", e);
    }
    
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("PT KUSUMA SAMUDERA BERKAH", 45, 18);
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("Buku Besar & Histori Pemakaian Alat Berat", 45, 25);
    
    doc.setFontSize(10);
    doc.text(`Dicetak pada: ${formatDate(new Date().toISOString())}`, 45, 31);

    // Detail Alat Berat
    doc.setFont("helvetica", "bold");
    doc.text("Detail Alat Berat", 14, 45);
    doc.setFont("helvetica", "normal");
    doc.text(`Nama: ${equipment.name}`, 14, 52);
    doc.text(`Merek/Tipe: ${equipment.brand || '-'} / ${equipment.type}`, 14, 58);
    doc.text(`Kapasitas: ${equipment.capacity ? equipment.capacity + ' Ton' : '-'}`, 14, 64);
    
    doc.setFont("helvetica", "bold");
    doc.text("Informasi Vendor", 110, 45);
    doc.setFont("helvetica", "normal");
    doc.text(`Vendor ID: ${equipment.vendor_id || '-'}`, 110, 52);

    const tableData = ledger.map((item, index) => {
      let debit = 0;
      let credit = 0;
      
      if (item.type === 'topup') {
        debit = item.amount;
      } else if (item.type === 'worklog') {
        credit = Math.abs(item.amount);
      }

      return [
        index + 1,
        formatDate(item.date),
        item.description,
        debit > 0 ? formatRupiah(debit) : '-',
        credit > 0 ? formatRupiah(credit) : '-',
        formatRupiah(item.running_balance)
      ];
    });

    autoTable(doc, {
      startY: 70,
      head: [["No.", "Tanggal", "Deskripsi", "Masuk (Debit)", "Keluar (Kredit)", "Saldo Berjalan"]],
      body: tableData,
      theme: "grid",
      headStyles: { fillColor: [16, 185, 129] },
      styles: { fontSize: 8 },
      columnStyles: {
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' }
      }
    });

    doc.save(`Ledger_${equipment.name.replace(/ /g, '_')}_${new Date().getTime()}.pdf`);
    toast.success("PDF berhasil didownload");
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center">
      <div className="relative p-6 border w-full max-w-5xl shadow-lg rounded-xl bg-white max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Buku Besar & Histori Pemakaian</h3>
            <p className="text-sm text-gray-500 mt-1">Alat Berat: {equipment?.name} {equipment?.brand ? `(${equipment.brand})` : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPdf}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm text-sm font-medium"
            >
              <Download size={16} />
              <span>Download PDF</span>
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 hover:bg-gray-100 p-2 rounded-full transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-2">
          {isLoading ? (
            <div className="flex justify-center items-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : error ? (
            <div className="text-center text-red-500 p-4">
              Gagal memuat data buku besar. Silakan coba lagi.
            </div>
          ) : ledger && ledger.length > 0 ? (
            <div className="relative">
              {/* Vertical timeline line */}
              <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200"></div>
              
              <div className="space-y-6 relative">
                {ledger.map((item, index) => {
                  let Icon = Activity;
                  let iconBg = "bg-gray-100 text-gray-500";
                  let amountClass = "text-gray-900";
                  
                  if (item.type === 'topup') {
                    Icon = ArrowDownRight; // Money coming in
                    iconBg = "bg-emerald-100 text-emerald-600";
                    amountClass = "text-emerald-600";
                  } else if (item.type === 'worklog') {
                    Icon = ArrowUpRight; // Money going out
                    iconBg = "bg-rose-100 text-rose-600";
                    amountClass = "text-rose-600";
                  } else if (item.type === 'rate_change') {
                    Icon = Info;
                    iconBg = "bg-blue-100 text-blue-600";
                  }

                  return (
                    <div key={`${item.id}-${index}`} className="flex items-start gap-4">
                      {/* Timeline Icon */}
                      <div className={`relative z-10 w-16 h-16 rounded-full flex items-center justify-center shrink-0 border-4 border-white ${iconBg}`}>
                        <Icon size={24} />
                      </div>
                      
                      {/* Content Card */}
                      <div className="flex-1 bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="text-xs text-gray-500 font-medium mb-1 flex items-center gap-1">
                              <Clock size={12} />
                              {formatDate(item.date)}
                            </div>
                            <h4 className="text-sm font-semibold text-gray-900">{item.description}</h4>
                          </div>
                          
                          {/* Running Balance */}
                          <div className="text-right">
                            <div className="text-xs text-gray-500 font-medium mb-1">Saldo Berjalan</div>
                            <div className="text-sm font-bold text-gray-900 bg-gray-50 px-3 py-1 rounded-lg">
                              {formatRupiah(item.running_balance)}
                            </div>
                          </div>
                        </div>

                        {/* Details based on type */}
                        {item.type === 'topup' && (
                          <div className="mt-3 flex items-center justify-between border-t border-gray-50 pt-3">
                            <div className="text-sm text-gray-600">Nominal Deposit</div>
                            <div className={`text-base font-bold ${amountClass}`}>
                              + {formatRupiah(item.amount)}
                            </div>
                          </div>
                        )}

                        {item.type === 'worklog' && (
                          <div className="mt-3 border-t border-gray-50 pt-3 flex items-center justify-between">
                            <div className="flex gap-4 text-sm">
                              <div>
                                <span className="text-gray-500 block text-xs">Pemakaian</span>
                                <span className="font-medium">{item.hours} Jam</span>
                              </div>
                              <div>
                                <span className="text-gray-500 block text-xs">Harga Diterapkan</span>
                                <span className="font-medium">{formatRupiah(item.applied_rate ?? 0)}/Jam</span>
                              </div>
                            </div>
                            <div className={`text-base font-bold ${amountClass}`}>
                              - {formatRupiah(Math.abs(item.amount))}
                            </div>
                          </div>
                        )}

                        {item.type === 'rate_change' && (
                          <div className="mt-3 border-t border-gray-50 pt-3 flex items-center gap-4 text-sm">
                            <div className="flex-1 bg-gray-50 rounded-lg p-2 text-center">
                              <div className="text-xs text-gray-500">Harga Lama</div>
                              <div className="font-medium text-gray-400 line-through">
                                {formatRupiah(item.old_rate ?? 0)}
                              </div>
                            </div>
                            <div className="text-gray-400">→</div>
                            <div className="flex-1 bg-blue-50 border border-blue-100 rounded-lg p-2 text-center">
                              <div className="text-xs text-blue-600 font-semibold">Harga Baru</div>
                              <div className="font-bold text-blue-700">
                                {formatRupiah(item.new_rate ?? 0)}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500 p-8 bg-gray-50 rounded-lg border border-dashed">
              Belum ada data historis untuk vendor ini.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EquipmentLedgerModal;
