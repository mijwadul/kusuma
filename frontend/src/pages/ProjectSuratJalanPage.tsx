import React, { useState } from 'react';
import { useProjectsList } from '../hooks/useProjects';
import { useCreateSuratJalan, useProjectSuratJalans, useUpdateSuratJalan, useDeleteSuratJalan, useSuratJalanTrucks } from '../hooks/useSuratJalan';
import { toast } from 'sonner';
import { Plus, X, Loader2, Truck } from 'lucide-react';
import AlertModal from '../components/AlertModal';

const inputCls = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300";

const SuratJalanFormModal = ({ 
  initialProjectId, 
  sjToEdit,
  onClose,
  onSuccess,
  projects
}: { 
  initialProjectId: string, 
  sjToEdit?: any,
  onClose: () => void,
  onSuccess: (projectId: string) => void,
  projects: any[]
}) => {
  const createSuratJalan = useCreateSuratJalan();
  const updateSuratJalan = useUpdateSuratJalan();
  
  const [projectId, setProjectId] = useState(sjToEdit?.project_id?.toString() || initialProjectId || '');
  const [formData, setFormData] = useState({
    driver_name: sjToEdit?.nama_supir || '',
    license_plate: sjToEdit?.nopol || '',
    origin: sjToEdit?.asal_tambang || '',
    gross_weight: sjToEdit?.bruto?.toString() || '',
    tare_weight: sjToEdit?.tarra?.toString() || '',
    length: sjToEdit?.panjang?.toString() || '',
    width: sjToEdit?.lebar?.toString() || '',
    height: sjToEdit?.tinggi?.toString() || '',
    minus_weight: sjToEdit?.minus_berat?.toString() || '0',
    minus_height: sjToEdit?.minus_tinggi?.toString() || '0'
  });

  const [isAutoFilled, setIsAutoFilled] = useState(false);
  const [pendingFieldChange, setPendingFieldChange] = useState<{name: string, value: string} | null>(null);
  const [showEditAlert, setShowEditAlert] = useState(false);
  
  const { data: trucksHistory = [] } = useSuratJalanTrucks();

  const handleNopolChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase();
    setFormData(prev => ({ ...prev, license_plate: val }));
    
    // Attempt auto-fill
    const found = trucksHistory.find((t: any) => t.nopol.toUpperCase() === val);
    if (found) {
      setFormData(prev => ({
        ...prev,
        driver_name: found.nama_supir || prev.driver_name,
        length: found.panjang?.toString() || prev.length,
        width: found.lebar?.toString() || prev.width,
        height: found.tinggi?.toString() || prev.height,
      }));
      setIsAutoFilled(true);
    } else {
      setIsAutoFilled(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (isAutoFilled && ['driver_name', 'length', 'width', 'height'].includes(name)) {
      setPendingFieldChange({ name, value });
      setShowEditAlert(true);
      return; // Prevent change until confirmed
    }
    
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const proj = projects.find(p => p.id.toString() === projectId);
  const measurementType = proj?.measurement_type || 'tonase';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) {
      toast.error('Pilih proyek terlebih dahulu');
      return;
    }

    try {
      const payload: any = {
        project_id: parseInt(projectId),
        nama_supir: formData.driver_name,
        nopol: formData.license_plate,
        asal_tambang: formData.origin,
      };

      if (measurementType === 'tonase') {
        payload.bruto = parseFloat(formData.gross_weight);
        payload.tarra = parseFloat(formData.tare_weight);
        payload.minus_berat = parseFloat(formData.minus_weight) || 0;
      } else {
        payload.panjang = parseFloat(formData.length);
        payload.lebar = parseFloat(formData.width);
        payload.tinggi = parseFloat(formData.height);
        payload.minus_tinggi = parseFloat(formData.minus_height) || 0;
      }

      if (sjToEdit) {
        await updateSuratJalan.mutateAsync({ id: sjToEdit.id, data: payload });
        toast.success('Surat jalan berhasil diperbarui!');
      } else {
        await createSuratJalan.mutateAsync(payload);
        toast.success('Surat jalan berhasil dibuat!');
      }
      onSuccess(projectId);
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Gagal menyimpan surat jalan');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold">{sjToEdit ? 'Edit Surat Jalan' : 'Catat Surat Jalan'}</h2>
          <button type="button" onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Proyek</label>
            <select
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              className={inputCls}
              required
            >
              <option value="">-- Pilih Proyek --</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.measurement_type === 'kubikasi' ? 'Kubikasi' : 'Tonase'})</option>
              ))}
            </select>
          </div>

          {proj && (
            <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100 mb-4 text-emerald-800 text-sm">
              Sistem mengunci mode input menjadi <strong>{measurementType === 'kubikasi' ? 'Kubikasi' : 'Tonase'}</strong> sesuai pengaturan proyek.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nama Supir</label>
              <input
                type="text"
                name="driver_name"
                value={formData.driver_name}
                onChange={handleChange}
                className={inputCls}
                required
                placeholder="Contoh: Budi"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nomor Polisi</label>
              <input
                type="text"
                name="license_plate"
                list="truck-history-list"
                value={formData.license_plate}
                onChange={handleNopolChange}
                className={inputCls}
                required
                placeholder="Contoh: B 1234 CD"
                autoComplete="off"
              />
              <datalist id="truck-history-list">
                {trucksHistory.map((t: any) => (
                  <option key={t.nopol} value={t.nopol} />
                ))}
              </datalist>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Asal Tambang / Lokasi</label>
            <input
              type="text"
              name="origin"
              value={formData.origin}
              onChange={handleChange}
              className={inputCls}
              required
              placeholder="Masukkan asal muatan"
            />
          </div>

          {proj && (
            <div className="pt-2">
              <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Truck size={16} className="text-emerald-600" />
                Data Ukuran
              </h3>
              {measurementType === 'tonase' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Bruto (Ton)</label>
                    <input
                      type="number"
                      step="any"
                      name="gross_weight"
                      value={formData.gross_weight}
                      onChange={handleChange}
                      className={inputCls}
                      required
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Tarra (Ton)</label>
                    <input
                      type="number"
                      step="any"
                      name="tare_weight"
                      value={formData.tare_weight}
                      onChange={handleChange}
                      className={inputCls}
                      required
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Minus / Potongan (Ton)</label>
                    <input
                      type="number"
                      step="any"
                      name="minus_weight"
                      value={formData.minus_weight}
                      onChange={handleChange}
                      className={inputCls}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Panjang (P)</label>
                    <input
                      type="number"
                      step="any"
                      name="length"
                      value={formData.length}
                      onChange={handleChange}
                      className={inputCls}
                      required
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Lebar (L)</label>
                    <input
                      type="number"
                      step="any"
                      name="width"
                      value={formData.width}
                      onChange={handleChange}
                      className={inputCls}
                      required
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Tinggi (T)</label>
                    <input
                      type="number"
                      step="any"
                      name="height"
                      value={formData.height}
                      onChange={handleChange}
                      className={inputCls}
                      required
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Minus Tinggi (m)</label>
                    <input
                      type="number"
                      step="any"
                      name="minus_height"
                      value={formData.minus_height}
                      onChange={handleChange}
                      className={inputCls}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              )}
              
              {/* Hasil Kalkulasi Otomatis */}
              <div className="mt-4 p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-between">
                <span className="text-sm font-medium text-emerald-800">
                  {measurementType === 'tonase' ? 'Netto Akhir:' : 'Volume Akhir:'}
                </span>
                <span className="text-xl font-bold text-emerald-600">
                  {measurementType === 'tonase' 
                    ? Math.max(0, (parseFloat(formData.gross_weight) || 0) - (parseFloat(formData.tare_weight) || 0) - (parseFloat(formData.minus_weight) || 0)).toFixed(2)
                    : (() => {
                        const p = parseFloat(formData.length) || 0;
                        const l = parseFloat(formData.width) || 0;
                        const t = parseFloat(formData.height) || 0;
                        const mt = parseFloat(formData.minus_height) || 0;
                        const rawM3 = (p * l * Math.max(0, t - mt)) / 1000000;
                        return (Math.floor(rawM3 * 100) / 100).toFixed(2);
                      })()
                  }
                </span>
                <span className="text-sm font-normal text-emerald-700 ml-1">
                  {measurementType === 'tonase' ? 'Ton' : 'm³'}
                </span>
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">Batal</button>
            <button type="submit" disabled={createSuratJalan.isPending || updateSuratJalan.isPending} className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors disabled:opacity-50">
              {createSuratJalan.isPending || updateSuratJalan.isPending ? 'Menyimpan...' : 'Simpan Surat Jalan'}
            </button>
          </div>
        </form>
      </div>

      <AlertModal
        isOpen={showEditAlert}
        onClose={() => {
          setShowEditAlert(false);
          setPendingFieldChange(null);
        }}
        onConfirm={() => {
          if (pendingFieldChange) {
            setFormData(prev => ({ ...prev, [pendingFieldChange.name]: pendingFieldChange.value }));
            setIsAutoFilled(false);
          }
          setShowEditAlert(false);
          setPendingFieldChange(null);
        }}
        title="Ubah Data Truk"
        message="Anda akan merubah data bawaan (supir/ukuran) dari truk ini. Lanjutkan?"
        confirmText="Ya, Lanjutkan"
        cancelText="Batal"
      />
    </div>
  );
};

const SuratJalanDetailModal = ({ 
  sj,
  measurementType,
  onClose,
  onEdit,
  onDelete
}: { 
  sj: any,
  measurementType: string,
  onClose: () => void,
  onEdit: () => void,
  onDelete: () => void
}) => {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold">Detail Surat Jalan</h2>
          <button type="button" onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Tanggal</p>
              <p className="text-sm font-medium">{new Date(sj.created_at).toLocaleString('id-ID')}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Asal Tambang</p>
              <p className="text-sm font-medium">{sj.asal_tambang}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Supir</p>
              <p className="text-sm font-medium">{sj.nama_supir}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">No Polisi</p>
              <p className="text-sm font-medium">{sj.nopol}</p>
            </div>
          </div>
          
          <div className="border-t border-gray-100 pt-4 mt-4">
            <h3 className="text-sm font-semibold mb-3">Data Ukuran ({measurementType === 'tonase' ? 'Tonase' : 'Kubikasi'})</h3>
            {measurementType === 'tonase' ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Bruto</p>
                  <p className="text-sm font-medium">{sj.bruto} Ton</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Tarra</p>
                  <p className="text-sm font-medium">{sj.tarra} Ton</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Potongan</p>
                  <p className="text-sm font-medium text-red-500">{sj.minus_berat} Ton</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Netto Akhir</p>
                  <p className="text-sm font-bold text-emerald-600">{sj.netto} Ton</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">P x L x T</p>
                  <p className="text-sm font-medium">{sj.panjang} x {sj.lebar} x {sj.tinggi}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Minus Tinggi</p>
                  <p className="text-sm font-medium text-red-500">{sj.minus_tinggi}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Volume Akhir</p>
                  <p className="text-sm font-bold text-emerald-600">{sj.volume?.toFixed(2)} m³</p>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="px-6 py-4 bg-gray-50 rounded-b-2xl flex justify-end gap-3 border-t border-gray-100">
          <button onClick={onDelete} className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors">
            Hapus
          </button>
          <button onClick={onEdit} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
            Edit Data
          </button>
        </div>
      </div>
    </div>
  );
};

export default function ProjectSuratJalanPage() {
  const { data: projects = [], isLoading: isLoadingProjects } = useProjectsList('ongoing');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [selectedSj, setSelectedSj] = useState<any>(null);
  const [sjToEdit, setSjToEdit] = useState<any>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  const deleteSuratJalan = useDeleteSuratJalan();

  const selectedProject = projects.find(p => p.id.toString() === selectedProjectId);
  const measurementType = selectedProject?.measurement_type || 'tonase';

  const { data: sjs = [], isLoading: isLoadingSjs } = useProjectSuratJalans(selectedProjectId);

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
            <select
              value={selectedProjectId}
              onChange={e => setSelectedProjectId(e.target.value)}
              className="w-full sm:w-64 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
            >
              <option value="">-- Pilih Proyek --</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.measurement_type === 'kubikasi' ? 'Kubikasi' : 'Tonase'})</option>
              ))}
            </select>
          )}
          
          <button
            onClick={() => setShowModal(true)}
            className="w-full sm:w-auto justify-center flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm disabled:opacity-50"
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b whitespace-nowrap">
                <tr>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Waktu</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Supir / Nopol</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Asal Tambang</th>
                  {measurementType === 'tonase' ? (
                    <>
                      <th className="px-4 py-3 text-right whitespace-nowrap">Bruto</th>
                      <th className="px-4 py-3 text-right whitespace-nowrap">Tarra</th>
                      <th className="px-4 py-3 text-right whitespace-nowrap">Potongan</th>
                      <th className="px-4 py-3 text-right whitespace-nowrap">Netto (Ton)</th>
                    </>
                  ) : (
                    <>
                      <th className="px-4 py-3 text-right whitespace-nowrap">P x L x T</th>
                      <th className="px-4 py-3 text-right whitespace-nowrap">Potongan (T)</th>
                      <th className="px-4 py-3 text-right whitespace-nowrap">Volume (m³)</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sjs.map((sj: any) => (
                  <tr 
                    key={sj.id} 
                    className="hover:bg-gray-50/50 cursor-pointer transition-colors"
                    onClick={() => setSelectedSj(sj)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">
                        {new Date(sj.created_at).toLocaleDateString('id-ID', {
                          day: 'numeric', month: 'short', year: 'numeric'
                        })}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(sj.created_at).toLocaleTimeString('id-ID', {
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{sj.nama_supir}</div>
                      <div className="text-xs text-gray-500">{sj.nopol}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{sj.asal_tambang}</td>
                    
                    {measurementType === 'tonase' ? (
                      <>
                        <td className="px-4 py-3 text-right text-gray-600">{sj.bruto?.toFixed(2) || '-'}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{sj.tarra?.toFixed(2) || '-'}</td>
                        <td className="px-4 py-3 text-right text-red-500">{sj.minus_berat ? sj.minus_berat.toFixed(2) : '-'}</td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-600">{sj.netto?.toFixed(2) || '-'}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {sj.panjang} x {sj.lebar} x {sj.tinggi}
                        </td>
                        <td className="px-4 py-3 text-right text-red-500">{sj.minus_tinggi ? sj.minus_tinggi.toFixed(2) : '-'}</td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-600">{sj.volume?.toFixed(2) || '-'}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
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
    </div>
  );
}
