import React, { useState } from 'react';
import { toast } from 'sonner';
import { X, FileText, Download } from 'lucide-react';
import apiClient from '../api/apiClient';
import { Vendor } from '../hooks/useVendors';
import CustomSelect from './CustomSelect';
import { useQuery } from '@tanstack/react-query';
import { generatePremiumPDF } from '../utils/pdfGenerator';
import { toLocalDateInput } from '../utils/formatters';

interface VendorReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendor: Vendor | null;
}

const formatIDR = (v: any) =>
  Number(v ?? 0).toLocaleString("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 });

export default function VendorReportModal({ isOpen, onClose, vendor }: VendorReportModalProps) {
  const [startDate, setStartDate] = useState(toLocalDateInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [endDate, setEndDate] = useState(toLocalDateInput(new Date()));
  const [projectId, setProjectId] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data } = await apiClient.get('/projects-data/projects');
      return data;
    },
    enabled: isOpen
  });

  if (!isOpen || !vendor) return null;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);

    try {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
      });
      if (projectId) {
        params.append('project_id', projectId);
      }

      const { data } = await apiClient.get(`/vendors/${vendor.id}/report?${params.toString()}`);
      
      const tableHead = [
        ['No', 'Nomor Polisi', 'Total Trip', 'Total Tonase (Ton)', 'Total Kubikasi (m³)', 'Estimasi Biaya Rental']
      ];

      const tableBody = data.truck_details.map((truck: any, index: number) => [
        index + 1,
        truck.nopol,
        truck.trips,
        truck.tonnage.toLocaleString('id-ID', { maximumFractionDigits: 2 }),
        truck.volume.toLocaleString('id-ID', { maximumFractionDigits: 2 }),
        formatIDR(truck.hauling_cost)
      ]);

      const summary = [
        { label: 'Total Top-Up / Deposit', value: formatIDR(data.total_topup) },
        { label: 'Total Trip Keseluruhan', value: `${data.hauling_summary.total_trips} Trip` },
        { label: 'Total Tonase Keseluruhan', value: `${data.hauling_summary.total_tonnage.toLocaleString('id-ID', { maximumFractionDigits: 2 })} Ton` },
        { label: 'Total Kubikasi Keseluruhan', value: `${data.hauling_summary.total_volume.toLocaleString('id-ID', { maximumFractionDigits: 2 })} m³` },
        { label: 'Total Estimasi Biaya Rental', value: formatIDR(data.hauling_summary.total_hauling_cost) },
      ];

      await generatePremiumPDF({
        title: `Laporan Aktivitas Vendor`,
        subtitle: `Vendor: ${data.vendor_name}\nProject: ${data.project_name}`,
        dateRange: data.period,
        filename: `Laporan_Vendor_${vendor.name.replace(/\s+/g, '_')}_${startDate}_${endDate}.pdf`,
        orientation: 'landscape',
        tableHead,
        tableBody,
        summary
      });

      toast.success('Laporan PDF berhasil dibuat!');
      onClose();
    } catch (error) {
      console.error(error);
      toast.error('Gagal mengambil data laporan vendor');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center bg-slate-800 p-4 border-b">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText className="text-blue-400" />
            Generate Laporan Vendor
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>
        
        <form onSubmit={handleGenerate} className="p-6 space-y-5">
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
            <p className="text-sm text-slate-700 font-medium">Vendor Terpilih:</p>
            <p className="text-lg font-bold text-slate-900">{vendor.name}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Tanggal Awal</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border-gray-300 rounded-lg shadow-sm p-2 border focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Tanggal Akhir</label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border-gray-300 rounded-lg shadow-sm p-2 border focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Filter Project (Opsional)</label>
            <CustomSelect
              value={projectId}
              onChange={(val) => setProjectId(val as string)}
              options={[
                { value: '', label: '-- Semua Project --' },
                ...projects.map((p: any) => ({ value: String(p.id), label: p.name }))
              ]}
            />
            <p className="text-xs text-gray-500 mt-1">Kosongkan jika ingin melihat semua aktivitas proyek.</p>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isGenerating}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-md shadow-blue-500/30 flex items-center gap-2 transition-colors disabled:opacity-70"
            >
              {isGenerating ? (
                <>Loading...</>
              ) : (
                <><Download size={18} /> Generate PDF</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
