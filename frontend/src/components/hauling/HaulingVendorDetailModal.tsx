import { useState } from 'react';
import { X, Building2, ChevronDown, ChevronRight, Edit, Trash2, FileText } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  vendor: any;
  obligations: any[];
  obligationDetails: any[];
  loadingObligationDetails: boolean;
  truckBalances: any[];
  allTopups: any[];
  onTopup: (vendorId: number) => void;
  onEditTopup: (topup: any) => void;
  onDeleteTopup: (topupId: number) => void;
  onEditVendor: (vendor: any) => void;
  onDeleteVendor: (vendorId: number) => void;
  setReportVendor: (vendor: any) => void;
}

export default function HaulingVendorDetailModal({
  isOpen,
  onClose,
  vendor,
  obligations,
  obligationDetails,
  loadingObligationDetails,
  truckBalances,
  allTopups,
  onTopup,
  onEditTopup,
  onDeleteTopup,
  onEditVendor,
  onDeleteVendor,
  setReportVendor
}: Props) {
  const [showObligationDetail, setShowObligationDetail] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<Record<number, boolean>>({});
  const [expandedNopols, setExpandedNopols] = useState<Record<string, boolean>>({});

  if (!isOpen || !vendor) return null;

  const obs = obligations.find((o: any) => o.vendor_id === vendor.id);
  const vendorTopups = allTopups.filter(t => t.vendor_id === vendor.id);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
      <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Building2 className="text-blue-600" /> Detail Vendor
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setReportVendor(vendor)}
              className="text-white bg-teal-600 hover:bg-teal-700 px-3 py-1.5 rounded font-medium flex items-center gap-1 text-sm"
            >
              <FileText size={16} /> Laporan
            </button>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><X size={20}/></button>
          </div>
        </div>
        
        <div className="space-y-4 mb-6">
          <div>
            <span className="block text-xs text-gray-500 mb-1">Nama Vendor</span>
            <p className="font-semibold text-gray-900">{vendor.name}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="block text-xs text-gray-500 mb-1">Kontak Person</span>
              <p className="font-medium text-gray-800">{vendor.contact_person || "-"}</p>
            </div>
            <div>
              <span className="block text-xs text-gray-500 mb-1">Telepon</span>
              <p className="font-medium text-gray-800">{vendor.phone || "-"}</p>
            </div>
          </div>
          <div>
            <span className="block text-xs text-gray-500 mb-1">Alamat</span>
            <p className="text-sm text-gray-800">{vendor.address || "-"}</p>
          </div>
        </div>

        {obs && (
          <div className="mb-6 bg-slate-50 border rounded-xl p-4 shadow-sm transition-all duration-300">
            <div className="flex justify-between items-center border-b pb-2 mb-3">
              <h4 className="text-sm font-bold text-gray-800">Kewajiban Hauling</h4>
              <button 
                onClick={() => setShowObligationDetail(!showObligationDetail)}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
              >
                {showObligationDetail ? "Tutup Detail" : "Lihat Detail"} {showObligationDetail ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            </div>
            
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-gray-500 mt-1">
                  {obs.total_ritase} Ritase &bull; {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(obs.total_measurement)} Unit (Ton/m³)
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Deposit Tersisa: Rp {Number(obs.balance_deposit).toLocaleString('id-ID')}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-gray-500 block mb-1">Total Biaya Hauling</span>
                <span className="font-bold text-lg text-rose-600">Rp {Number(obs.total_obligation).toLocaleString('id-ID')}</span>
              </div>
            </div>

            {/* EXPANDABLE DETAIL SECTION */}
            {showObligationDetail && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <h5 className="text-xs font-bold text-gray-700 mb-3">Rincian per Project:</h5>
                {loadingObligationDetails ? (
                  <p className="text-xs text-gray-500 italic">Memuat rincian...</p>
                ) : obligationDetails.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">Tidak ada rincian data.</p>
                ) : (
                  <div className="space-y-2">
                    {obligationDetails.map((proj: any) => (
                      <div key={proj.project_id} className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                        {/* Project Header */}
                        <div 
                          className="px-3 py-2 bg-slate-100 flex justify-between items-center cursor-pointer hover:bg-slate-200 transition-colors"
                          onClick={() => setExpandedProjects(prev => ({...prev, [proj.project_id]: !prev[proj.project_id]}))}
                        >
                          <div className="flex items-center gap-2">
                            {expandedProjects[proj.project_id] ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
                            <span className="font-semibold text-sm text-slate-800">{proj.project_name}</span>
                          </div>
                          <div className="text-right text-xs">
                            <span className="font-bold text-rose-600">Rp {Number(proj.total_obligation).toLocaleString('id-ID')}</span>
                          </div>
                        </div>
                        
                        {/* Nopol List inside Project */}
                        {expandedProjects[proj.project_id] && (
                          <div className="divide-y divide-slate-100 bg-white">
                            {proj.nopols.length === 0 && <div className="p-3 text-xs text-slate-500 italic">Tidak ada nopol</div>}
                            {proj.nopols.map((nopol: any) => (
                              <div key={nopol.nopol} className="flex flex-col">
                                {/* Nopol Header */}
                                <div 
                                  className="px-4 py-2 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors pl-8"
                                  onClick={() => setExpandedNopols(prev => ({...prev, [`${proj.project_id}-${nopol.nopol}`]: !prev[`${proj.project_id}-${nopol.nopol}`]}))}
                                >
                                  <div className="flex items-center gap-2">
                                    {expandedNopols[`${proj.project_id}-${nopol.nopol}`] ? <ChevronDown size={12} className="text-slate-400" /> : <ChevronRight size={12} className="text-slate-400" />}
                                    <span className="font-bold text-sm text-slate-700">{nopol.nopol}</span>
                                    <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{nopol.total_ritase} Ritase</span>
                                  </div>
                                  <div className="text-right text-xs font-semibold text-slate-700">
                                    Rp {Number(nopol.total_obligation).toLocaleString('id-ID')}
                                  </div>
                                </div>
                                
                                {/* Date List inside Nopol */}
                                {expandedNopols[`${proj.project_id}-${nopol.nopol}`] && (
                                  <div className="bg-slate-50 pl-12 pr-4 py-2 space-y-1 border-t border-slate-100">
                                    {nopol.dates.map((d: any, idx: number) => (
                                      <div key={idx} className="flex justify-between items-center text-[11px]">
                                        <span className="text-slate-600">{new Date(d.date).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'})}</span>
                                        <div className="flex items-center gap-4">
                                          <span className="text-slate-500 w-12 text-right">{d.ritase} Rit</span>
                                          <span className="text-slate-500 w-16 text-right">{Number(d.measurement).toLocaleString('id-ID', { maximumFractionDigits: 2 })} Unit</span>
                                          <span className="text-slate-700 font-medium w-24 text-right">Rp {Number(d.obligation).toLocaleString('id-ID')}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {truckBalances.length > 0 && (
          <div className="mb-6 bg-indigo-50 border border-indigo-100 rounded-xl p-4 shadow-sm">
            <h4 className="text-sm font-bold text-indigo-900 border-b border-indigo-200 pb-2 mb-3">Saldo Deposit per Unit (Nopol)</h4>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {truckBalances.map((tb: any) => (
                <div key={tb.truck_id} className="flex justify-between items-center bg-white p-2 rounded border border-indigo-100">
                  <div>
                    <span className="font-bold text-gray-800">{tb.nopol}</span>
                    <div className="text-[10px] text-gray-500">
                      Topup: {Number(tb.total_topup).toLocaleString('id-ID')} | Cost: {Number(tb.total_hauling_cost).toLocaleString('id-ID')}
                    </div>
                  </div>
                  <span className={`font-bold text-sm ${tb.balance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {tb.balance < 0 ? '-' : ''}Rp {Math.abs(tb.balance).toLocaleString('id-ID')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mb-6">
          <h4 className="text-sm font-bold text-gray-800 border-b pb-2 mb-3">Riwayat Deposit</h4>
          <div className="max-h-48 overflow-y-auto pr-1 flex flex-col gap-2">
            {vendorTopups.length === 0 ? (
              <p className="text-gray-400 text-sm italic">Belum ada deposit.</p>
            ) : (
              vendorTopups.map(t => (
                <div key={t.id} className="bg-gray-50 border rounded-lg p-3 flex justify-between items-center">
                  <div>
                    <p className="text-xs text-gray-500">{new Date(t.topup_date).toLocaleDateString('id-ID')}</p>
                    <p className="font-bold text-emerald-600 text-sm">Rp {Number(t.amount).toLocaleString('id-ID')}</p>
                    {t.notes && <p className="text-xs text-gray-600 mt-1">{t.notes}</p>}
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => onEditTopup(t)}
                      className="text-indigo-600 hover:text-indigo-800 bg-indigo-50 p-1.5 rounded"
                    >
                      <Edit size={14} />
                    </button>
                    <button 
                      onClick={() => onDeleteTopup(t.id)}
                      className="text-red-600 hover:text-red-800 bg-red-50 p-1.5 rounded"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t border-gray-100">
          <button
            onClick={() => onTopup(vendor.id)}
            className="flex-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 py-2 rounded-xl text-sm font-bold flex justify-center items-center gap-2 transition-colors"
          >
            + Deposit
          </button>
          <button
            onClick={() => onEditVendor(vendor)}
            className="flex-1 bg-blue-100 text-blue-700 hover:bg-blue-200 py-2 rounded-xl text-sm font-bold flex justify-center items-center gap-2 transition-colors"
          >
            <Edit size={16} /> Edit Vendor
          </button>
          <button
            onClick={() => {
              onDeleteVendor(vendor.id);
              onClose();
            }}
            className="px-3 bg-red-100 text-red-600 hover:bg-red-200 py-2 rounded-xl text-sm font-bold flex justify-center items-center gap-2 transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
