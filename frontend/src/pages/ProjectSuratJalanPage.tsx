import React, { useState } from 'react';
import { useProjectsList } from '../hooks/useProjects';
import {
  useProjectSuratJalans,
  useDeleteSuratJalan,
  useLatestSuratJalanProject,
} from '../hooks/useSuratJalan';
import { toast } from 'sonner';
import {
  Plus,
  Loader2,
  Truck,
  FileText,
  ChevronDown,
  ChevronRight,
  X,
} from 'lucide-react';
import AlertModal from '../components/AlertModal';
import { generatePremiumPDF } from '../utils/pdfGenerator';
import { useVendors } from '../hooks/useVendors';
import CustomSelect from '../components/CustomSelect';
import MultiSelect from '../components/MultiSelect';
import SuratJalanFormModal from '../components/surat_jalan/SuratJalanFormModal';
import SuratJalanDetailModal from '../components/surat_jalan/SuratJalanDetailModal';

export default function ProjectSuratJalanPage() {
  const { data: projects = [], isLoading: isLoadingProjects } = useProjectsList('ongoing');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const { data: latestProject } = useLatestSuratJalanProject();
  
  React.useEffect(() => {
    if (!selectedProjectId && latestProject?.project_id) {
      setSelectedProjectId(latestProject.project_id);
    } else if (!selectedProjectId && !latestProject?.project_id && projects.length > 0) {
      // Fallback if no surat jalan exists anywhere
      setSelectedProjectId(projects[0].id.toString());
    }
  }, [latestProject, selectedProjectId, projects]);
  
  const [showModal, setShowModal] = useState(false);
  const [selectedSj, setSelectedSj] = useState<any>(null);
  const [sjToEdit, setSjToEdit] = useState<any>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  const deleteSuratJalan = useDeleteSuratJalan();
  const [showPdfModal, setShowPdfModal] = useState(false);
  const { data: allVendors = [] } = useVendors('hauling');

  const selectedProject = projects.find(p => p.id.toString() === selectedProjectId);
  const measurementType = selectedProject?.measurement_type || 'tonase';

  const { data: sjs = [], isLoading: isLoadingSjs } = useProjectSuratJalans(selectedProjectId);

  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
  const [expandedNopols, setExpandedNopols] = useState<Record<string, boolean>>({});
  
  const toggleDate = (date: string) => {
    setExpandedDates(prev => ({ ...prev, [date]: !prev[date] }));
  };
  const toggleNopol = (key: string) => {
    setExpandedNopols(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const groupedSjs = React.useMemo(() => {
    const byDate: Record<string, Record<string, any[]>> = {};
    sjs.forEach((sj: any) => {
      const dateStr = new Date(sj.created_at).toLocaleDateString('id-ID');
      const nopol = sj.nopol || 'Tanpa Nopol';
      if (!byDate[dateStr]) byDate[dateStr] = {};
      if (!byDate[dateStr][nopol]) byDate[dateStr][nopol] = [];
      byDate[dateStr][nopol].push(sj);
    });
    return byDate;
  }, [sjs]);

  const exportToPdf = async (params: {
    projectId: string;
    startDate: string;
    endDate: string;
    vendorId: string;
    nopol?: string;
    nopols?: string[];
  }) => {
    const project = projects.find(p => p.id.toString() === params.projectId);
    if (!project) return;
    const mt = project.measurement_type || 'tonase';
    
    const targetNopols = (params.nopols && params.nopols.length > 0)
      ? params.nopols.map(n => n.toLowerCase())
      : params.nopol
        ? [params.nopol.toLowerCase()]
        : [];

    let filtered = sjs.filter((sj: any) => {
      const sjDate = new Date(sj.created_at).toISOString().slice(0, 10);
      const inRange = sjDate >= params.startDate && sjDate <= params.endDate;
      const nopolMatch = targetNopols.length > 0
        ? targetNopols.includes((sj.nopol || '').toLowerCase())
        : true;
      const vendorMatch = params.vendorId ? (sj.vendor_id?.toString() === params.vendorId || (!sj.vendor_id && params.vendorId === 'manual')) : true;
      return inRange && nopolMatch && vendorMatch;
    });

    if (filtered.length === 0) {
      toast.error('Tidak ada data surat jalan pada filter yang dipilih');
      return;
    }

    try {
      const nopolLabel = params.nopols && params.nopols.length > 0
        ? `Nopol: ${params.nopols.join(', ')}`
        : params.nopol 
          ? `Nopol: ${params.nopol}` 
          : '';

      const vendorLabel = nopolLabel && params.vendorId
        ? `Vendor: ${allVendors.find((v: any) => v.id.toString() === params.vendorId)?.name || 'Manual'} | ${nopolLabel}`
        : nopolLabel 
          ? nopolLabel 
          : params.vendorId
            ? (allVendors.find((v: any) => v.id.toString() === params.vendorId)?.name || 'Manual')
            : 'Semua Vendor & Armada';

      let totalTonase = 0;
      let totalKubikasi = 0;
      let trontonCount = 0;
      let coltCount = 0;
      const vendorTotals: Record<string, number> = {};

      filtered.forEach((sj: any) => {
        const vName = sj.vendor_name || 'Manual/Lainnya';
        if (mt === 'tonase') {
          totalTonase += sj.netto || 0;
          vendorTotals[vName] = (vendorTotals[vName] || 0) + (sj.netto || 0);
        } else {
          totalKubikasi += sj.volume || 0;
          vendorTotals[vName] = (vendorTotals[vName] || 0) + (sj.volume || 0);
        }
        const tType = (sj.truck_type || '').toLowerCase();
        let isTronton: boolean;
        if (tType) {
          isTronton = tType === 'tronton';
        } else if (mt === 'tonase') {
          isTronton = (sj.netto || 0) > 20;
        } else {
          isTronton = (sj.volume || 0) > 20;
        }
        if (isTronton) trontonCount++;
        else coltCount++;
      });

      // ── Grouping untuk Lembar Rekapitulasi (Page 1 Table) ─────────────────
      const rekapPerDate = new Map<string, {
        dateStr: string;
        ritase: number;
        tronton: number;
        colt: number;
        totalMeas: number;
      }>();

      filtered.forEach((sj: any) => {
        const d = new Date(sj.created_at);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const sjDateStr = `${y}-${m}-${day}`;

        if (!rekapPerDate.has(sjDateStr)) {
          rekapPerDate.set(sjDateStr, {
            dateStr: sjDateStr,
            ritase: 0,
            tronton: 0,
            colt: 0,
            totalMeas: 0,
          });
        }
        const item = rekapPerDate.get(sjDateStr)!;
        item.ritase += 1;
        const tType = (sj.truck_type || '').toLowerCase();
        const isTronton = tType ? tType === 'tronton' : ((sj.netto || sj.volume || 0) > 20);
        if (isTronton) item.tronton += 1;
        else item.colt += 1;

        const val = mt === 'tonase' ? (sj.netto || 0) : mt === 'kubikasi' ? (sj.volume || 0) : 1;
        item.totalMeas += val;
      });

      const sortedRekapDates = Array.from(rekapPerDate.values()).sort((a, b) => a.dateStr.localeCompare(b.dateStr));

      const rekapHead = [
        [
          'No',
          'Tanggal Operasional',
          'Total Ritase',
          'Armada Tronton',
          'Armada Colt Diesel',
          `Total ${mt === 'tonase' ? 'Tonase (Ton)' : mt === 'kubikasi' ? 'Kubikasi (m³)' : 'Ritase'}`,
        ],
      ];

      const formatQty = (n: number | null | undefined): string => {
        if (n == null || isNaN(n)) return '0';
        const rounded = Math.round((n + Number.EPSILON) * 100) / 100;
        return rounded.toString();
      };

      const rekapBody: (string | number | any)[][] = sortedRekapDates.map((item, idx) => {
        const [y, m, d] = item.dateStr.split('-');
        return [
          idx + 1,
          `${d}/${m}/${y}`,
          `${item.ritase} Rit`,
          `${item.tronton} Rit`,
          `${item.colt} Rit`,
          mt === 'tonase' ? `${formatQty(item.totalMeas)} Ton` : mt === 'kubikasi' ? `${formatQty(item.totalMeas)} m³` : `${item.ritase} Rit`,
        ];
      });

      // Total row in rekap table
      rekapBody.push([
        { content: 'TOTAL KESELURUHAN:', colSpan: 2, styles: { fontStyle: 'bold', halign: 'right', fillColor: [241, 245, 249] } },
        { content: `${filtered.length} Rit`, styles: { fontStyle: 'bold', halign: 'center', fillColor: [241, 245, 249] } },
        { content: `${trontonCount} Rit`, styles: { fontStyle: 'bold', halign: 'center', fillColor: [241, 245, 249] } },
        { content: `${coltCount} Rit`, styles: { fontStyle: 'bold', halign: 'center', fillColor: [241, 245, 249] } },
        { content: `${mt === 'tonase' ? formatQty(totalTonase) + ' Ton' : formatQty(totalKubikasi) + ' m³'}`, styles: { fontStyle: 'bold', halign: 'right', textColor: [13, 148, 136], fillColor: [241, 245, 249] } },
      ]);

      const tableHead = [['No', 'Waktu', 'Nopol', 'Supir', 'Vendor', 'Tipe', mt === 'tonase' ? 'Bruto / Tarra (Kg)' : mt === 'kubikasi' ? 'P x L x T' : 'Keterangan', mt === 'tonase' ? 'Netto' : mt === 'kubikasi' ? 'Volume' : 'Jumlah']];
      
      const grouped: Record<string, Record<string, any[]>> = {};
      filtered.forEach((sj: any) => {
        const d = new Date(sj.created_at);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const sjDateStr = `${y}-${m}-${day}`;
        
        const nopol = (sj.nopol || 'Tanpa Nopol').toUpperCase();
        if (!grouped[sjDateStr]) grouped[sjDateStr] = {};
        if (!grouped[sjDateStr][nopol]) grouped[sjDateStr][nopol] = [];
        grouped[sjDateStr][nopol].push(sj);
      });

      const tableBody: any[] = [];
      
      Object.keys(grouped).sort().forEach(dateStr => {
        const [y, m, d] = dateStr.split('-');
        const displayDate = `${d}/${m}/${y}`;
        
        Object.keys(grouped[dateStr]).sort().forEach(nopol => {
          const sjs = grouped[dateStr][nopol];
          tableBody.push([
            { 
              content: `Tanggal: ${displayDate} | Nopol: ${nopol} (${sjs.length} Ritase)`, 
              colSpan: 8, 
              styles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', halign: 'left' } 
            }
          ]);
          
          let subTotal = 0;
          sjs.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

          sjs.forEach((sj: any, idx: number) => {
            const tType = (sj.truck_type || '').toLowerCase();
            let isTronton: boolean;
            if (tType) {
              isTronton = tType === 'tronton';
            } else if (mt === 'tonase') {
              isTronton = (sj.netto || 0) > 20;
            } else {
              isTronton = (sj.volume || 0) > 20;
            }
            const val = mt === 'tonase' ? (sj.netto || 0) : mt === 'kubikasi' ? (sj.volume || 0) : 1;
            subTotal += val;

            tableBody.push([
              idx + 1,
              new Date(sj.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
              sj.nopol || '-',
              sj.nama_supir || '-',
              sj.vendor_name || '-',
              isTronton ? 'Tronton' : 'Colt Diesel',
              mt === 'tonase'
                ? `${sj.bruto ? Math.round(sj.bruto).toLocaleString('id-ID') : '-'} / ${sj.tarra ? Math.round(sj.tarra).toLocaleString('id-ID') : '-'}`
                : mt === 'kubikasi' ? `${sj.panjang || '-'}x${sj.lebar || '-'}x${sj.tinggi || '-'}` : '-',
              mt === 'tonase' ? `${formatQty(val)} T` : mt === 'kubikasi' ? `${formatQty(val)} m³` : '1 Rit'
            ]);
          });

          tableBody.push([
            { content: 'Subtotal:', colSpan: 7, styles: { fontStyle: 'bold', halign: 'right' } },
            { content: mt === 'tonase' ? `${formatQty(subTotal)} T` : mt === 'kubikasi' ? `${formatQty(subTotal)} m³` : `${subTotal} Rit`, styles: { fontStyle: 'bold', textColor: [13, 148, 136] } }
          ]);
        });
      });


      await generatePremiumPDF({
        title: "REKAPITULASI SURAT JALAN PROYEK",
        subtitle: `Proyek: ${project.name}`,
        dateRange: `${params.startDate} s/d ${params.endDate}`,
        filename: `Surat_Jalan_${project.name.replace(/\s+/g, '_')}_${params.startDate}_${params.endDate}.pdf`,
        orientation: 'landscape',
        recipient: {
          name: project.name,
          subName: project.client_name ? `Klien: ${project.client_name}` : undefined,
          address: project.location || undefined,
          contact: vendorLabel !== 'Semua Vendor & Armada' ? vendorLabel : undefined,
        },
        rekapTitle: "REKAPITULASI OPERASIONAL SURAT JALAN",
        rekapHead,
        rekapBody,
        detailTitle: "LAMPIRAN RINCIAN DETAIL SURAT JALAN PROYEK",
        tableHead,
        tableBody,
      });

      setShowPdfModal(false);
      toast.success('PDF Surat Jalan berhasil didownload');
    } catch (err) {
      toast.error('Gagal export PDF');
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Surat Jalan Proyek</h1>
          <p className="text-sm text-gray-500 mt-1">Catat dan pantau surat jalan operasional proyek</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          {isLoadingProjects ? (
            <div className="h-10 w-full sm:w-64 border border-gray-200 rounded-xl flex items-center px-3 bg-gray-50 text-gray-500 text-sm">
              Memuat proyek...
            </div>
          ) : (
            <div className="w-full sm:w-64">
              <CustomSelect
                value={selectedProjectId}
                onChange={(val) => setSelectedProjectId(val as string)}
                options={[
                  { value: "", label: "-- Pilih Proyek --" },
                  ...projects.map(p => ({
                    value: String(p.id),
                    label: `${p.name} (${p.measurement_type === 'kubikasi' ? 'Kubikasi' : p.measurement_type === 'ritase' ? 'Ritase' : 'Tonase'})`
                  }))
                ]}
              />
            </div>
          )}
          
          <button
            onClick={() => setShowPdfModal(true)}
            disabled={sjs.length === 0 && !selectedProjectId}
            className="w-full sm:w-auto justify-center flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm disabled:opacity-50"
          >
            <FileText size={16} /> Export PDF
          </button>

          <button
            onClick={() => setShowModal(true)}
            className="w-full sm:w-auto justify-center flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm disabled:opacity-50"
          >
            <Plus size={16} /> Catat Surat Jalan
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[400px]">
        {!selectedProjectId ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Truck size={48} className="mb-4 text-gray-300" />
            <p className="text-sm">Silakan pilih proyek terlebih dahulu untuk melihat surat jalan</p>
          </div>
        ) : isLoadingSjs ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <Loader2 size={24} className="animate-spin" />
          </div>
        ) : sjs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <p className="text-sm">Belum ada surat jalan yang diinput untuk proyek ini.</p>
          </div>
        ) : (
          <div className="overflow-hidden">
            {Object.keys(groupedSjs).sort((a,b) => new Date(b).getTime() - new Date(a).getTime()).map(dateStr => (
              <div key={dateStr} className="border-b last:border-b-0 border-gray-100">
                <button 
                  onClick={() => toggleDate(dateStr)}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    {expandedDates[dateStr] ? <ChevronDown size={18} className="text-gray-500"/> : <ChevronRight size={18} className="text-gray-500"/>}
                    <span className="font-bold text-gray-800">{dateStr}</span>
                  </div>
                  <span className="bg-white px-2 py-1 rounded text-xs font-semibold text-gray-500 shadow-sm border">
                    {Object.values(groupedSjs[dateStr]).flat().length} Surat Jalan
                  </span>
                </button>
                
                {expandedDates[dateStr] && (
                  <div className="bg-white">
                    {Object.keys(groupedSjs[dateStr]).sort().map(nopol => {
                      const groupSjs = groupedSjs[dateStr][nopol];
                      const nopolKey = `${dateStr}-${nopol}`;
                      return (
                        <div key={nopolKey} className="border-t border-gray-50">
                          <button 
                            onClick={() => toggleNopol(nopolKey)}
                            className="w-full flex items-center justify-between py-3 px-6 hover:bg-emerald-50/30 transition-colors text-left group"
                          >
                            <div className="flex items-center gap-3">
                              {expandedNopols[nopolKey] ? <ChevronDown size={16} className="text-gray-400 group-hover:text-emerald-500"/> : <ChevronRight size={16} className="text-gray-400 group-hover:text-emerald-500"/>}
                              <div className="flex items-center gap-2">
                                <Truck size={15} className="text-gray-400"/>
                                <span className="font-semibold text-gray-700">{nopol}</span>
                              </div>
                            </div>
                            <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-xs font-bold">
                              {groupSjs.length} Ritase
                            </span>
                          </button>

                          {expandedNopols[nopolKey] && (
                            <div className="px-8 pb-3 overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead className="bg-gray-50 border-b whitespace-nowrap">
                                  <tr>
                                    <th className="px-4 py-2 text-left font-medium text-gray-500">Waktu</th>
                                    <th className="px-4 py-2 text-left font-medium text-gray-500">Supir</th>
                                    <th className="px-4 py-2 text-left font-medium text-gray-500">Asal Tambang</th>
                                    <th className="px-4 py-2 text-left font-medium text-gray-500">Vendor</th>
                                    {measurementType === 'tonase' ? (
                                      <>
                                        <th className="px-4 py-2 text-right font-medium text-gray-500">Bruto (Kg)</th>
                                        <th className="px-4 py-2 text-right font-medium text-gray-500">Tarra (Kg)</th>
                                        <th className="px-4 py-2 text-right font-medium text-gray-500">Potongan (Kg)</th>
                                        <th className="px-4 py-2 text-right font-bold text-emerald-700">Netto (Ton)</th>
                                      </>
                                    ) : (
                                      <>
                                        <th className="px-4 py-2 text-right font-medium text-gray-500">P x L x T</th>
                                        <th className="px-4 py-2 text-right font-medium text-gray-500">Potongan</th>
                                        <th className="px-4 py-2 text-right font-bold text-emerald-700">Volume</th>
                                      </>
                                    )}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                  {groupSjs.map((sj: any) => (
                                    <tr 
                                      key={sj.id} 
                                      className="hover:bg-emerald-50/50 cursor-pointer transition-colors"
                                      onClick={() => setSelectedSj(sj)}
                                    >
                                      <td className="px-4 py-2 text-gray-600">
                                        {new Date(sj.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                      </td>
                                      <td className="px-4 py-2 font-medium text-gray-700">{sj.nama_supir}</td>
                                      <td className="px-4 py-2 text-gray-500">{sj.asal_tambang}</td>
                                      <td className="px-4 py-2 text-gray-500">{sj.vendor_name || '-'}</td>
                                      
                                      {measurementType === 'tonase' ? (
                                        <>
                                          <td className="px-4 py-2 text-right text-gray-500">{sj.bruto ? Math.round(sj.bruto).toLocaleString('id-ID') : '-'}</td>
                                          <td className="px-4 py-2 text-right text-gray-500">{sj.tarra ? Math.round(sj.tarra).toLocaleString('id-ID') : '-'}</td>
                                          <td className="px-4 py-2 text-right text-red-400">{sj.minus_berat ? Math.round(sj.minus_berat).toLocaleString('id-ID') : '-'}</td>
                                          <td className="px-4 py-2 text-right font-bold text-emerald-600">{sj.netto?.toFixed(2) || '-'} T</td>
                                        </>
                                      ) : (
                                        <>
                                          <td className="px-4 py-2 text-right text-gray-500">{sj.panjang}x{sj.lebar}x{sj.tinggi}</td>
                                          <td className="px-4 py-2 text-right text-red-400">{sj.minus_tinggi ? sj.minus_tinggi.toFixed(2) : '-'}</td>
                                          <td className="px-4 py-2 text-right font-bold text-emerald-600">{sj.volume?.toFixed(2) || '-'} m³</td>
                                        </>
                                      )}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <SuratJalanFormModal
          initialProjectId={selectedProjectId}
          sjToEdit={sjToEdit}
          onClose={() => {
            setShowModal(false);
            setSjToEdit(null);
          }}
          onSuccess={(pid) => setSelectedProjectId(pid)}
          projects={projects}
        />
      )}
      
      {selectedSj && (
        <SuratJalanDetailModal
          sj={selectedSj}
          measurementType={measurementType}
          onClose={() => setSelectedSj(null)}
          onEdit={() => {
            setSjToEdit(selectedSj);
            setSelectedSj(null);
            setShowModal(true);
          }}
          onDelete={() => setShowDeleteModal(true)}
        />
      )}

      <AlertModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={async () => {
          if (selectedSj) {
            try {
              await deleteSuratJalan.mutateAsync(selectedSj.id);
              toast.success('Surat jalan berhasil dihapus');
              setSelectedSj(null);
            } catch (err: any) {
              toast.error('Gagal menghapus surat jalan');
            }
          }
          setShowDeleteModal(false);
        }}
        title="Hapus Surat Jalan"
        message="Yakin ingin menghapus surat jalan ini? Data yang dihapus tidak dapat dikembalikan."
        confirmText={deleteSuratJalan.isPending ? "Menghapus..." : "Hapus"}
        cancelText="Batal"
      />

      {/* PDF EXPORT MODAL */}
      {showPdfModal && (
        <PdfExportModal
          projects={projects}
          defaultProjectId={selectedProjectId}
          vendors={allVendors}
          onClose={() => setShowPdfModal(false)}
          onExport={exportToPdf}
          sjs={sjs}
        />
      )}
    </div>
  );
}

function PdfExportModal({ projects, defaultProjectId, vendors, onClose, onExport, sjs }: {
  projects: any[];
  defaultProjectId: string;
  vendors: any[];
  onClose: () => void;
  onExport: (params: { projectId: string; startDate: string; endDate: string; vendorId: string; nopol?: string; nopols?: string[] }) => void;
  sjs: any[];
}) {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const [projectId, setProjectId] = React.useState(defaultProjectId || (projects[0]?.id?.toString() ?? ''));
  const [startDate, setStartDate] = React.useState(firstOfMonth);
  const [endDate, setEndDate] = React.useState(today);
  const [vendorId, setVendorId] = React.useState('');
  const [selectedNopols, setSelectedNopols] = React.useState<string[]>([]);

  const nopolOptions = React.useMemo(() => {
    if (!projectId) return [];
    const unique = Array.from(new Set(sjs.filter(s => s.project_id.toString() === projectId).map(s => s.nopol).filter(Boolean))).sort();
    return unique.map(n => ({ value: n as string, label: n as string }));
  }, [sjs, projectId]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText size={18} className="text-rose-600" /> Export PDF Surat Jalan
          </h2>
          <button type="button" onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Proyek <span className="text-red-500">*</span></label>
            <CustomSelect
              value={projectId}
              onChange={(val) => {
                setProjectId(val as string);
                setSelectedNopols([]);
              }}
              required
              options={[
                { value: "", label: "-- Pilih Proyek --" },
                ...projects.map(p => ({
                  value: String(p.id),
                  label: `${p.name} (${p.measurement_type === 'kubikasi' ? 'Kubikasi' : 'Tonase'})`
                }))
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tanggal Mulai</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tanggal Akhir</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center justify-between">
              <span>Nomor Polisi (Opsional)</span>
              {selectedNopols.length > 0 && (
                <span className="text-xs text-rose-600 font-semibold bg-rose-50 px-2 py-0.5 rounded-md">
                  {selectedNopols.length} nopol dipilih
                </span>
              )}
            </label>
            <MultiSelect
              values={selectedNopols}
              onChange={setSelectedNopols}
              options={nopolOptions}
              placeholder="-- Semua Nopol --"
              searchPlaceholder="Cari nopol truk..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Vendor (Opsional)</label>
            <CustomSelect
              value={vendorId}
              onChange={(val) => setVendorId(val as string)}
              options={[
                { value: "", label: "Semua Vendor" },
                { value: "manual", label: "Manual / Tanpa Vendor" },
                ...vendors.map((v: any) => ({
                  value: String(v.id),
                  label: v.name
                }))
              ]}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100 mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200">Batal</button>
            <button
              type="button"
              disabled={!projectId}
              onClick={() => onExport({ projectId, startDate, endDate, vendorId, nopols: selectedNopols, nopol: selectedNopols[0] })}
              className="px-5 py-2 bg-rose-600 text-white rounded-xl text-sm font-semibold hover:bg-rose-700 disabled:opacity-50 flex items-center gap-2"
            >
              <FileText size={15} /> Generate PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
