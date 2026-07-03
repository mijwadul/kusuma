import React, { useState } from 'react';
import { useProjectsList } from '../hooks/useProjects';
import { useCreateSuratJalan, useProjectSuratJalans, useUpdateSuratJalan, useDeleteSuratJalan, useSuratJalanTrucks, useLatestSuratJalanProject } from '../hooks/useSuratJalan';
import { toast } from 'sonner';
import { Plus, X, Loader2, Truck, FileText, ChevronDown, ChevronRight, Trash2, Pencil } from 'lucide-react';
import AlertModal from '../components/AlertModal';
import { toLocalDateTimeInputString, truncToTwo, formatNopol, formatTitleCase } from '../utils/formatters';
import { generatePremiumPDF } from '../utils/pdfGenerator';

import { useVendorTrucks } from '../hooks/useHauling';
import { useVendors } from '../hooks/useVendors';
import CustomSelect from '../components/CustomSelect';
import CustomCombobox from '../components/CustomCombobox';

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
    vendor_id: sjToEdit?.vendor_id?.toString() || '',
    vendor_name: sjToEdit?.vendor_name || '',
    truck_id: sjToEdit?.truck_id?.toString() || '',
    origin: sjToEdit?.asal_tambang || '',
    gross_weight: sjToEdit?.bruto?.toString() || '',
    tare_weight: sjToEdit?.tarra?.toString() || '',
    length: sjToEdit?.panjang?.toString() || '',
    width: sjToEdit?.lebar?.toString() || '',
    height: sjToEdit?.tinggi?.toString() || '',
    minus_weight: sjToEdit?.minus_berat?.toString() || '0',
    minus_height: sjToEdit?.minus_tinggi?.toString() || '0',
    truck_type: sjToEdit?.truck_type || '',
    created_at: toLocalDateTimeInputString(sjToEdit?.created_at)
  });

  const [isAutoFilled, setIsAutoFilled] = useState(false);
  const [pendingFieldChange, setPendingFieldChange] = useState<{name: string, value: string} | null>(null);
  const [showEditAlert, setShowEditAlert] = useState(false);
  
  const [migrationTarget, setMigrationTarget] = useState<{
    nopol: string;
    driver: string;
    oldVendorName: string;
    newVendorName: string;
    newVendorId: string;
    truckId: string;
    truckType: string;
    length: string;
    width: string;
    height: string;
  } | null>(null);
  
  const { data: vendors = [] } = useVendors('hauling');

  const { data: vendorTrucks } = useVendorTrucks(formData.vendor_id ? Number(formData.vendor_id) : undefined);

  // Fallback for custom nopol
  const { data: trucksHistory = [] } = useSuratJalanTrucks();

  const handleNopolChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = formatNopol(e.target.value);
    
    // Always search through trucksHistory first to find ownership globally
    const foundGlobal = trucksHistory.find((t: any) => t.nopol.toUpperCase() === val);
    
    if (foundGlobal) {
      if (formData.vendor_id && foundGlobal.vendor_id && foundGlobal.vendor_id.toString() !== formData.vendor_id) {
        // SCENARIO B: Vendor is already selected, but user types a nopol belonging to a different vendor.
        const currentVendorName = vendors.find((v: any) => v.id.toString() === formData.vendor_id)?.name || formData.vendor_name;
        setMigrationTarget({
          nopol: val,
          driver: foundGlobal.nama_supir || formData.driver_name,
          oldVendorName: foundGlobal.vendor_name || "Vendor Lain",
          newVendorName: currentVendorName || "Vendor Baru",
          newVendorId: formData.vendor_id,
          truckId: foundGlobal.truck_id?.toString() || '',
          truckType: foundGlobal.truck_type || formData.truck_type,
          length: foundGlobal.panjang?.toString() || formData.length,
          width: foundGlobal.lebar?.toString() || formData.width,
          height: foundGlobal.tinggi?.toString() || formData.height,
        });
        return; // wait for modal
      }

      setFormData(prev => ({
        ...prev,
        license_plate: val,
        truck_id: foundGlobal.truck_id?.toString() || '',
        vendor_id: foundGlobal.vendor_id ? foundGlobal.vendor_id.toString() : prev.vendor_id,
        vendor_name: foundGlobal.vendor_name || prev.vendor_name,
        driver_name: foundGlobal.nama_supir || prev.driver_name,
        length: foundGlobal.panjang?.toString() || prev.length,
        width: foundGlobal.lebar?.toString() || prev.width,
        height: foundGlobal.tinggi?.toString() || prev.height,
        truck_type: foundGlobal.truck_type || prev.truck_type
      }));
      setIsAutoFilled(true);
    } else {
      setFormData(prev => ({ ...prev, license_plate: val, truck_id: '' }));
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
    
    let formattedValue = value;
    if (name === 'license_plate') formattedValue = formatNopol(value);
    else if (name === 'driver_name') formattedValue = formatTitleCase(value);
    
    const newFormData = { ...formData, [name]: formattedValue };
    const detected = autoDetectTruckType(measurementType,
      newFormData.gross_weight, newFormData.tare_weight, newFormData.minus_weight,
      newFormData.length, newFormData.width, newFormData.height, newFormData.minus_height
    );
    setFormData({ ...newFormData, truck_type: detected || newFormData.truck_type });
  };

  const handleKgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const digitsOnly = value.replace(/\D/g, '');
    const newFormData = { ...formData, [name]: digitsOnly };
    const detected = autoDetectTruckType(measurementType, 
      name === 'gross_weight' ? digitsOnly : newFormData.gross_weight,
      name === 'tare_weight' ? digitsOnly : newFormData.tare_weight,
      name === 'minus_weight' ? digitsOnly : newFormData.minus_weight,
      newFormData.length, newFormData.width, newFormData.height, newFormData.minus_height
    );
    setFormData({ ...newFormData, truck_type: detected || newFormData.truck_type });
  };

  const formatKg = (val: string | number) => {
    if (!val) return '';
    return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const autoDetectTruckType = (mt: string, gross: string, tare: string, minusW: string, p: string, l: string, t: string, minusH: string) => {
    if (mt === 'tonase') {
      const netto = (parseFloat(gross) || 0) - (parseFloat(tare) || 0) - (parseFloat(minusW) || 0);
      const nettoTon = netto / 1000;
      return nettoTon > 20 ? 'tronton' : nettoTon > 0 ? 'colt_diesel' : '';
    } else {
      const pV = parseFloat(p) || 0;
      const lV = parseFloat(l) || 0;
      const tV = parseFloat(t) || 0;
      const mH = parseFloat(minusH) || 0;
      const vol = (pV * lV * Math.max(0, tV - mH)) / 1000000;
      return vol > 20 ? 'tronton' : vol > 0 ? 'colt_diesel' : '';
    }
  };

  const proj = projects.find(p => p.id.toString() === projectId);
  const measurementType = proj?.measurement_type || 'tonase';

  const handleSubmit = async (e?: React.FormEvent, isMigrationConfirmed = false, migrationData?: any) => {
    if (e) e.preventDefault();
    if (!projectId) {
      toast.error('Pilih proyek terlebih dahulu');
      return;
    }

    const finalFormData = migrationData ? { ...formData, ...migrationData } : formData;

    try {
      const payload: any = {
        project_id: parseInt(projectId),
        vendor_id: finalFormData.vendor_id ? parseInt(finalFormData.vendor_id) : null,
        vendor_name: finalFormData.vendor_name || undefined,
        truck_id: finalFormData.truck_id ? parseInt(finalFormData.truck_id) : null,
        truck_type: finalFormData.truck_type || undefined,
        nama_supir: finalFormData.driver_name,
        nopol: finalFormData.license_plate,
        asal_tambang: finalFormData.origin,
        created_at: finalFormData.created_at || undefined,
        migrate_truck: isMigrationConfirmed
      };

      if (measurementType === 'tonase') {
        payload.bruto = parseFloat(finalFormData.gross_weight);
        payload.tarra = parseFloat(finalFormData.tare_weight);
        payload.minus_berat = parseFloat(finalFormData.minus_weight) || 0;
      } else {
        payload.panjang = parseFloat(finalFormData.length);
        payload.lebar = parseFloat(finalFormData.width);
        payload.tinggi = parseFloat(finalFormData.height);
        payload.minus_tinggi = parseFloat(finalFormData.minus_height) || 0;
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold">{sjToEdit ? 'Edit Surat Jalan' : 'Catat Surat Jalan'}</h2>
          <button type="button" onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tanggal & Waktu</label>
              <input
                type="datetime-local"
                name="created_at"
                value={formData.created_at}
                onChange={handleChange}
                className={inputCls}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Proyek</label>
              <CustomSelect
                value={projectId}
                onChange={(val) => setProjectId(val as string)}
                options={[
                  { value: "", label: "-- Pilih Proyek --" },
                  ...projects.map(p => ({
                    value: String(p.id),
                    label: `${p.name} (${p.measurement_type === 'kubikasi' ? 'Kubikasi' : 'Tonase'})`
                  }))
                ]}
              />
            </div>
          </div>

          {proj && (
            <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100 mb-4 text-emerald-800 text-sm">
              Sistem mengunci mode input menjadi <strong>{measurementType === 'kubikasi' ? 'Kubikasi' : measurementType === 'ritase' ? 'Ritase' : 'Tonase'}</strong> sesuai pengaturan proyek.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Vendor Hauling</label>
              <CustomCombobox
                value={formData.vendor_name || ''}
                onChange={(val) => {
                  const foundVendor = vendors?.find((x: any) => x.name.toLowerCase() === val.trim().toLowerCase());
                  
                  // SCENARIO A: Truck already selected, but user changes the vendor
                  if (formData.license_plate && isAutoFilled && formData.vendor_id && foundVendor && foundVendor.id.toString() !== formData.vendor_id) {
                    setMigrationTarget({
                      nopol: formData.license_plate,
                      driver: formData.driver_name,
                      oldVendorName: formData.vendor_name,
                      newVendorName: foundVendor.name,
                      newVendorId: foundVendor.id.toString(),
                      truckId: formData.truck_id,
                      truckType: formData.truck_type,
                      length: formData.length,
                      width: formData.width,
                      height: formData.height,
                    });
                    return;
                  }

                  setFormData(prev => ({ 
                    ...prev, 
                    vendor_name: val,
                    vendor_id: foundVendor ? foundVendor.id.toString() : '',
                    truck_id: prev.license_plate ? prev.truck_id : '', 
                    license_plate: prev.license_plate ? prev.license_plate : '', 
                    driver_name: prev.license_plate ? prev.driver_name : '', 
                    length: prev.license_plate ? prev.length : '', 
                    width: prev.license_plate ? prev.width : '', 
                    height: prev.license_plate ? prev.height : '' 
                  }));
                  if (!formData.license_plate) setIsAutoFilled(false);
                }}
                placeholder="Pilih atau ketik vendor..."
                options={vendors ? vendors.map((v: any) => ({ value: v.name, label: v.name })) : []}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nomor Polisi</label>
              <CustomCombobox
                value={formData.license_plate}
                onChange={(val) => handleNopolChange({ target: { name: 'license_plate', value: val } } as any)}
                required
                placeholder="Contoh: B 1234 CD"
                options={
                  // Always show all trucks but prioritize vendor trucks if selected
                  Array.from(new Set([
                    ...(formData.vendor_id && vendorTrucks ? vendorTrucks : []),
                    ...trucksHistory
                  ].map(t => t.nopol))).map(nopol => {
                    const t = trucksHistory.find((x: any) => x.nopol === nopol) || vendorTrucks?.find((x: any) => x.nopol === nopol);
                    return {
                      value: t.nopol,
                      label: t.nama_supir || t.supir_default ? `${t.nopol} (${t.nama_supir || t.supir_default})` : t.nopol
                    };
                  })
                }
              />
            </div>

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
          </div>

          {proj && (
            <div className="pt-2">
              {measurementType !== 'ritase' && (
                <>
                  <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <Truck size={16} className="text-emerald-600" />
                    Data Ukuran
                  </h3>
                  {measurementType === 'tonase' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Bruto (Kg)</label>
                        <input
                          type="text"
                          name="gross_weight"
                          value={formatKg(formData.gross_weight)}
                          onChange={handleKgChange}
                          className={inputCls}
                          required
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Tarra (Kg)</label>
                        <input
                          type="text"
                          name="tare_weight"
                          value={formatKg(formData.tare_weight)}
                          onChange={handleKgChange}
                          className={inputCls}
                          required
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Minus / Potongan (Kg)</label>
                        <input
                          type="text"
                          name="minus_weight"
                          value={formatKg(formData.minus_weight)}
                          onChange={handleKgChange}
                          className={inputCls}
                          placeholder="0"
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
                  {(() => {
                    let calcValue = 0;
                    if (measurementType === 'tonase') {
                      calcValue = Math.max(0, ((parseFloat(formData.gross_weight) || 0) - (parseFloat(formData.tare_weight) || 0) - (parseFloat(formData.minus_weight) || 0)) / 1000);
                    } else {
                      const p = parseFloat(formData.length) || 0;
                      const l = parseFloat(formData.width) || 0;
                      const t = parseFloat(formData.height) || 0;
                      const mt = parseFloat(formData.minus_height) || 0;
                      calcValue = Math.floor((p * l * Math.max(0, t - mt)) / 1000000 * 100) / 100;
                    }
                    const isLarge = calcValue > 20;
                    return (
                      <div className="mt-4 p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-between">
                        <span className="text-sm font-medium text-emerald-800">
                          {measurementType === 'tonase' ? 'Netto Akhir:' : 'Volume Akhir:'}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-xl font-bold text-emerald-600">
                            {calcValue.toFixed(2)}
                          </span>
                          <span className="text-sm font-normal text-emerald-700">
                            {measurementType === 'tonase' ? 'Ton' : 'm³'}
                          </span>
                          {isLarge && (
                            <span className="text-xs bg-orange-100 text-orange-700 font-semibold px-2 py-0.5 rounded-full">
                              ≥ 20 → Tronton
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}

              {measurementType === 'ritase' && (
                <div className="mt-2 p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-between">
                  <span className="text-sm font-medium text-emerald-800">
                    Total Ritase:
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-bold text-emerald-600">
                      1
                    </span>
                    <span className="text-sm font-normal text-emerald-700">
                      Rit / Trip
                    </span>
                  </div>
                </div>
              )}

              {/* Tipe Kendaraan */}
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Tipe Kendaraan
                  {formData.truck_type && measurementType !== 'ritase' && (
                    <span className="ml-2 text-xs text-emerald-600 font-normal">✓ terdeteksi otomatis</span>
                  )}
                </label>
                <CustomSelect
                  value={formData.truck_type}
                  onChange={(val) => handleChange({ target: { name: 'truck_type', value: val } } as any)}
                  options={[
                    { value: "", label: "-- Pilih Tipe --" },
                    { value: "tronton", label: "Tronton" },
                    { value: "colt_diesel", label: "Colt Diesel" }
                  ]}
                />
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

      {migrationTarget && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Pindah Kepemilikan Armada</h3>
            <p className="text-sm text-gray-600 mb-4">
              Armada nopol <strong>{migrationTarget.nopol}</strong> dengan supir <strong>{migrationTarget.driver}</strong> ini sebelumnya milik <strong>{migrationTarget.oldVendorName}</strong>. Apakah Anda yakin ingin memindahkannya ke <strong>{migrationTarget.newVendorName}</strong>?
            </p>
            <div className="bg-amber-50 text-amber-800 text-xs p-3 rounded-xl border border-amber-200 mb-5">
              <p className="font-semibold mb-1">Jika Anda setuju:</p>
              <ol className="list-decimal pl-4 space-y-1">
                <li>Transaksi ini akan dicatat atas nama {migrationTarget.newVendorName}.</li>
                <li>Sistem akan memindahkan kepemilikan armada di database secara permanen ke {migrationTarget.newVendorName}.</li>
                <li>Data riwayat transaksi di masa lalu tidak akan rusak/berubah.</li>
              </ol>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setMigrationTarget(null)}
                className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  const newFormData = {
                    license_plate: migrationTarget.nopol,
                    driver_name: migrationTarget.driver,
                    vendor_id: migrationTarget.newVendorId,
                    vendor_name: migrationTarget.newVendorName,
                    truck_id: migrationTarget.truckId,
                    truck_type: migrationTarget.truckType,
                    length: migrationTarget.length,
                    width: migrationTarget.width,
                    height: migrationTarget.height
                  };
                  setFormData(prev => ({
                    ...prev,
                    ...newFormData
                  }));
                  setIsAutoFilled(true);
                  setMigrationTarget(null);
                  handleSubmit(undefined, true, newFormData);
                }}
                className="flex-1 py-2.5 bg-amber-600 text-white rounded-xl text-sm font-semibold hover:bg-amber-700 transition-colors"
              >
                Ya, Pindahkan
              </button>
            </div>
          </div>
        </div>
      )}

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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
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
            {measurementType === 'ritase' ? (
              <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                <span className="text-sm font-medium text-emerald-800">Total Ritase</span>
                <span className="text-lg font-bold text-emerald-600">1 Rit / Trip</span>
              </div>
            ) : (
              <>
                <h3 className="text-sm font-semibold mb-3">Data Ukuran ({measurementType === 'tonase' ? 'Tonase' : 'Kubikasi'})</h3>
                {measurementType === 'tonase' ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Bruto (Kg)</p>
                      <p className="text-sm font-medium">{sj.bruto ? Math.round(sj.bruto).toLocaleString('id-ID') : '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Tarra (Kg)</p>
                      <p className="text-sm font-medium">{sj.tarra ? Math.round(sj.tarra).toLocaleString('id-ID') : '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Potongan (Kg)</p>
                      <p className="text-sm font-medium text-red-500">{sj.minus_berat ? Math.round(sj.minus_berat).toLocaleString('id-ID') : '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Netto Akhir</p>
                      <p className="text-sm font-bold text-emerald-600">{sj.netto?.toFixed(2)} Ton</p>
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
              </>
            )}
          </div>
        </div>
        <div className="px-6 py-4 bg-gray-50 rounded-b-2xl flex justify-end gap-3 border-t border-gray-100">
          <button onClick={onDelete} className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-sm font-semibold transition-colors">
            <Trash2 size={16} /> Hapus
          </button>
          <button onClick={onEdit} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white hover:bg-blue-700 rounded-xl text-sm font-semibold transition-colors">
            <Pencil size={16} /> Edit
          </button>
        </div>
      </div>
    </div>
  );
};

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

  const exportToPdf = async (params: { projectId: string; startDate: string; endDate: string; vendorId: string; nopol?: string }) => {
    const project = projects.find(p => p.id.toString() === params.projectId);
    if (!project) return;
    const mt = project.measurement_type || 'tonase';
    
    let filtered = sjs.filter((sj: any) => {
      const sjDate = new Date(sj.created_at).toISOString().slice(0, 10);
      const inRange = sjDate >= params.startDate && sjDate <= params.endDate;
      const nopolMatch = params.nopol ? (sj.nopol || '').toLowerCase() === params.nopol.toLowerCase() : true;
      const vendorMatch = params.vendorId ? (sj.vendor_id?.toString() === params.vendorId || (!sj.vendor_id && params.vendorId === 'manual')) : true;
      return inRange && nopolMatch && vendorMatch;
    });

    if (filtered.length === 0) {
      toast.error('Tidak ada data surat jalan pada filter yang dipilih');
      return;
    }

    try {
      const vendorLabel = params.nopol && params.vendorId
        ? `Vendor: ${allVendors.find((v: any) => v.id.toString() === params.vendorId)?.name || 'Manual'} | Nopol: ${params.nopol}`
        : params.nopol 
          ? `Nopol: ${params.nopol}` 
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
              mt === 'tonase' ? `${val.toFixed(2)} T` : mt === 'kubikasi' ? `${val.toFixed(2)} m³` : '1 Rit'
            ]);
          });

          tableBody.push([
            { content: 'Subtotal:', colSpan: 7, styles: { fontStyle: 'bold', halign: 'right' } },
            { content: mt === 'tonase' ? `${subTotal.toFixed(2)} T` : mt === 'kubikasi' ? `${subTotal.toFixed(2)} m³` : `${subTotal} Rit`, styles: { fontStyle: 'bold', textColor: [13, 148, 136] } }
          ]);
        });
      });

      const summaryItems = [
        `Total Ritase Tronton: ${trontonCount}`,
        `Total Ritase Colt Diesel: ${coltCount}`,
        `Grand Total: ${mt === 'tonase' ? truncToTwo(totalTonase) + ' Ton' : truncToTwo(totalKubikasi) + ' m³'}`,
        '',
        'Total per Vendor:'
      ];
      Object.keys(vendorTotals).forEach(v => {
        summaryItems.push(`  ${v}: ${truncToTwo(vendorTotals[v])} ${mt === 'tonase' ? 'Ton' : 'm³'}`);
      });

      await generatePremiumPDF({
        title: "Laporan Surat Jalan Proyek",
        subtitle: `Proyek: ${project.name} | ${vendorLabel}`,
        dateRange: `${params.startDate} s/d ${params.endDate}`,
        filename: `Surat_Jalan_${project.name.replace(/\s+/g, '_')}_${params.startDate}_${params.endDate}.pdf`,
        tableHead,
        tableBody,
        summaryItems
      });

      setShowPdfModal(false);
      toast.success('PDF berhasil didownload');
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
                    label: `${p.name} (${p.measurement_type === 'kubikasi' ? 'Kubikasi' : 'Tonase'})`
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
  onExport: (params: { projectId: string; startDate: string; endDate: string; vendorId: string; nopol: string }) => void;
  sjs: any[];
}) {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const [projectId, setProjectId] = React.useState(defaultProjectId || (projects[0]?.id?.toString() ?? ''));
  const [startDate, setStartDate] = React.useState(firstOfMonth);
  const [endDate, setEndDate] = React.useState(today);
  const [vendorId, setVendorId] = React.useState('');
  const [nopol, setNopol] = React.useState('');

  const availableNopols = React.useMemo(() => {
    if (!projectId) return [];
    return Array.from(new Set(sjs.filter(s => s.project_id.toString() === projectId).map(s => s.nopol).filter(Boolean))).sort();
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
              onChange={(val) => setProjectId(val as string)}
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
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nomor Polisi (Opsional)</label>
            <CustomSelect
              value={nopol}
              onChange={(val) => setNopol(val as string)}
              options={[
                { value: "", label: "Semua Nopol" },
                ...availableNopols.map(n => ({ value: n as string, label: n as string }))
              ]}
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
              onClick={() => onExport({ projectId, startDate, endDate, vendorId, nopol })}
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
