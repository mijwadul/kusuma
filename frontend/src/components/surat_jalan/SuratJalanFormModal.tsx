import React, { useState } from 'react';
import { toast } from 'sonner';
import { X, Truck } from 'lucide-react';
import {
  useCreateSuratJalan,
  useUpdateSuratJalan,
  useSuratJalanTrucks,
} from '../../hooks/useSuratJalan';
import { useVendors } from '../../hooks/useVendors';
import { useVendorTrucks } from '../../hooks/useHauling';
import AlertModal from '../AlertModal';
import CustomSelect from '../CustomSelect';
import CustomCombobox from '../CustomCombobox';
import { toLocalDateTimeInputString, formatNopol, formatTitleCase } from '../../utils/formatters';

const inputCls =
  'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300';

interface SuratJalanFormModalProps {
  initialProjectId: string;
  sjToEdit?: any;
  onClose: () => void;
  onSuccess: (projectId: string) => void;
  projects: any[];
}

export default function SuratJalanFormModal({
  initialProjectId,
  sjToEdit,
  onClose,
  onSuccess,
  projects,
}: SuratJalanFormModalProps) {
  const createSuratJalan = useCreateSuratJalan();
  const updateSuratJalan = useUpdateSuratJalan();

  const [projectId, setProjectId] = useState(
    sjToEdit?.project_id?.toString() || initialProjectId || ''
  );
  const [formData, setFormData] = useState({
    driver_name: sjToEdit?.nama_supir || '',
    license_plate: sjToEdit?.nopol || '',
    vendor_id: sjToEdit?.vendor_id?.toString() || '',
    vendor_name: sjToEdit?.vendor_name || '',
    loading_vendor_id: sjToEdit?.loading_vendor_id?.toString() || '',
    loading_vendor_name: sjToEdit?.loading_vendor_name || '',
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
    created_at: toLocalDateTimeInputString(sjToEdit?.created_at),
  });

  const [isAutoFilled, setIsAutoFilled] = useState(false);
  const [pendingFieldChange, setPendingFieldChange] = useState<{
    name: string;
    value: string;
  } | null>(null);
  const [showEditAlert, setShowEditAlert] = useState(false);

  const [lockedTruckType, setLockedTruckType] = useState<string>(sjToEdit?.truck_type || '');
  const [showTruckTypeAlert, setShowTruckTypeAlert] = useState(false);
  const [pendingTruckType, setPendingTruckType] = useState<string | null>(null);

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
  const { data: loadingVendors = [] } = useVendors('jasa_loading');

  const { data: vendorTrucks } = useVendorTrucks(
    formData.vendor_id ? Number(formData.vendor_id) : undefined
  );

  // Fallback for custom nopol
  const { data: trucksHistory = [] } = useSuratJalanTrucks();

  const handleNopolChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = formatNopol(e.target.value);

    // Always search through trucksHistory first to find ownership globally
    const foundGlobal = trucksHistory.find((t: any) => t.nopol.toUpperCase() === val);
    const foundVendorTruck = vendorTrucks?.find((t: any) => t.nopol.toUpperCase() === val);
    const historyTruckType = foundGlobal?.truck_type || foundVendorTruck?.tipe_truk || '';

    if (foundGlobal) {
      if (
        formData.vendor_id &&
        foundGlobal.vendor_id &&
        foundGlobal.vendor_id.toString() !== formData.vendor_id
      ) {
        // SCENARIO B: Vendor is already selected, but user types a nopol belonging to a different vendor.
        const currentVendorName =
          vendors.find((v: any) => v.id.toString() === formData.vendor_id)?.name ||
          formData.vendor_name;
        setMigrationTarget({
          nopol: val,
          driver: foundGlobal.nama_supir || formData.driver_name,
          oldVendorName: foundGlobal.vendor_name || 'Vendor Lain',
          newVendorName: currentVendorName || 'Vendor Baru',
          newVendorId: formData.vendor_id,
          truckId: foundGlobal.truck_id?.toString() || '',
          truckType: foundGlobal.truck_type || formData.truck_type,
          length: foundGlobal.panjang?.toString() || formData.length,
          width: foundGlobal.lebar?.toString() || formData.width,
          height: foundGlobal.tinggi?.toString() || formData.height,
        });
        return; // wait for modal
      }

      setFormData((prev) => ({
        ...prev,
        license_plate: val,
        truck_id: foundGlobal.truck_id?.toString() || '',
        vendor_id: foundGlobal.vendor_id ? foundGlobal.vendor_id.toString() : prev.vendor_id,
        vendor_name: foundGlobal.vendor_name || prev.vendor_name,
        driver_name: foundGlobal.nama_supir || prev.driver_name,
        length: foundGlobal.panjang?.toString() || prev.length,
        width: foundGlobal.lebar?.toString() || prev.width,
        height: foundGlobal.tinggi?.toString() || prev.height,
        truck_type: foundGlobal.truck_type || prev.truck_type,
      }));
      setLockedTruckType(foundGlobal.truck_type || '');
      setIsAutoFilled(true);
    } else {
      setFormData((prev) => ({
        ...prev,
        license_plate: val,
        truck_id: foundVendorTruck?.id?.toString() || '',
        truck_type: historyTruckType || prev.truck_type,
      }));
      setLockedTruckType(historyTruckType || '');
      setIsAutoFilled(false);
    }
  };

  const handleTruckTypeChange = (newVal: string) => {
    if (
      formData.truck_type &&
      newVal !== formData.truck_type &&
      (measurementType === 'ritase' || lockedTruckType)
    ) {
      setPendingTruckType(newVal);
      setShowTruckTypeAlert(true);
    } else {
      setFormData((prev) => ({ ...prev, truck_type: newVal }));
      if (newVal) {
        setLockedTruckType(newVal);
      }
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
    const detected = autoDetectTruckType(
      measurementType,
      newFormData.gross_weight,
      newFormData.tare_weight,
      newFormData.minus_weight,
      newFormData.length,
      newFormData.width,
      newFormData.height,
      newFormData.minus_height
    );
    setFormData({ ...newFormData, truck_type: detected || newFormData.truck_type });
  };

  const handleKgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const digitsOnly = value.replace(/\D/g, '');
    const newFormData = { ...formData, [name]: digitsOnly };
    const detected = autoDetectTruckType(
      measurementType,
      name === 'gross_weight' ? digitsOnly : newFormData.gross_weight,
      name === 'tare_weight' ? digitsOnly : newFormData.tare_weight,
      name === 'minus_weight' ? digitsOnly : newFormData.minus_weight,
      newFormData.length,
      newFormData.width,
      newFormData.height,
      newFormData.minus_height
    );
    setFormData({ ...newFormData, truck_type: detected || newFormData.truck_type });
  };

  const formatKg = (val: string | number) => {
    if (!val) return '';
    return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const autoDetectTruckType = (
    mt: string,
    gross: string,
    tare: string,
    minusW: string,
    p: string,
    l: string,
    t: string,
    minusH: string
  ) => {
    if (mt === 'ritase') return '';
    if (mt === 'tonase') {
      const netto = (parseFloat(gross) || 0) - (parseFloat(tare) || 0) - (parseFloat(minusW) || 0);
      const nettoTon = netto / 1000;
      return nettoTon > 25 ? 'tronton' : nettoTon > 0 ? 'colt_diesel' : '';
    } else {
      const pV = parseFloat(p) || 0;
      const lV = parseFloat(l) || 0;
      const tV = parseFloat(t) || 0;
      const mH = parseFloat(minusH) || 0;
      const vol = (pV * lV * Math.max(0, tV - mH)) / 1000000;
      return vol > 20 ? 'tronton' : vol > 0 ? 'colt_diesel' : '';
    }
  };

  const proj = projects.find((p) => p.id.toString() === projectId);
  const measurementType = proj?.measurement_type || 'tonase';

  const handleSubmit = async (
    e?: React.FormEvent,
    isMigrationConfirmed = false,
    migrationData?: any
  ) => {
    if (e) e.preventDefault();
    if (!projectId) {
      toast.error('Pilih proyek terlebih dahulu');
      return;
    }

    const finalFormData = migrationData ? { ...formData, ...migrationData } : formData;

    if (measurementType === 'ritase' && !finalFormData.truck_type) {
      toast.error('Pilih tipe kendaraan (Colt Diesel atau Tronton) untuk proyek ritase');
      return;
    }

    try {
      const payload: any = {
        project_id: parseInt(projectId),
        vendor_id: finalFormData.vendor_id ? parseInt(finalFormData.vendor_id) : null,
        vendor_name: finalFormData.vendor_name || undefined,
        loading_vendor_id: finalFormData.loading_vendor_id
          ? parseInt(finalFormData.loading_vendor_id)
          : null,
        loading_vendor_name: finalFormData.loading_vendor_name || undefined,
        truck_id: finalFormData.truck_id ? parseInt(finalFormData.truck_id) : null,
        truck_type: finalFormData.truck_type || undefined,
        nama_supir: finalFormData.driver_name,
        nopol: finalFormData.license_plate,
        asal_tambang: finalFormData.origin,
        created_at: finalFormData.created_at || undefined,
        migrate_truck: isMigrationConfirmed,
      };

      if (measurementType === 'tonase') {
        payload.bruto = parseFloat(finalFormData.gross_weight);
        payload.tarra = parseFloat(finalFormData.tare_weight);
        payload.minus_berat = parseFloat(finalFormData.minus_weight) || 0;
      } else if (measurementType === 'kubikasi') {
        payload.panjang = parseFloat(finalFormData.length);
        payload.lebar = parseFloat(finalFormData.width);
        payload.tinggi = parseFloat(finalFormData.height);
        payload.minus_tinggi = parseFloat(finalFormData.minus_height) || 0;
      }
      // if 'ritase', no extra weight/volume fields needed

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
          <h2 className="text-lg font-semibold">
            {sjToEdit ? 'Edit Surat Jalan' : 'Catat Surat Jalan'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Tanggal &amp; Waktu
              </label>
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
                  { value: '', label: '-- Pilih Proyek --' },
                  ...projects.map((p) => ({
                    value: String(p.id),
                    label: `${p.name} (${
                      p.measurement_type === 'kubikasi'
                        ? 'Kubikasi'
                        : p.measurement_type === 'ritase'
                        ? 'Ritase'
                        : 'Tonase'
                    })`,
                  })),
                ]}
              />
            </div>
          </div>

          {proj && (
            <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100 mb-4 text-emerald-800 text-sm">
              Sistem mengunci mode input menjadi{' '}
              <strong>
                {measurementType === 'kubikasi'
                  ? 'Kubikasi'
                  : measurementType === 'ritase'
                  ? 'Ritase'
                  : 'Tonase'}
              </strong>{' '}
              sesuai pengaturan proyek.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Dimuat Oleh (Vendor Loading)
              </label>
              <CustomCombobox
                value={formData.loading_vendor_name || ''}
                onChange={(val) => {
                  const foundVendor = loadingVendors?.find(
                    (x: any) => x.name.toLowerCase() === val.trim().toLowerCase()
                  );
                  setFormData((prev) => ({
                    ...prev,
                    loading_vendor_name: val,
                    loading_vendor_id: foundVendor ? foundVendor.id.toString() : '',
                  }));
                }}
                placeholder="Pilih atau ketik vendor loading"
                options={
                  loadingVendors
                    ? loadingVendors.map((v: any) => ({ value: v.name, label: v.name }))
                    : []
                }
              />
              <p className="text-xs text-gray-500 mt-1">
                Kosongkan jika muatan dimuat oleh Alat Berat Internal Perusahaan.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Vendor Hauling</label>
              <CustomCombobox
                value={formData.vendor_name || ''}
                onChange={(val) => {
                  const foundVendor = vendors?.find(
                    (x: any) => x.name.toLowerCase() === val.trim().toLowerCase()
                  );

                  // SCENARIO A: Truck already selected, but user changes the vendor
                  if (
                    formData.license_plate &&
                    isAutoFilled &&
                    formData.vendor_id &&
                    foundVendor &&
                    foundVendor.id.toString() !== formData.vendor_id
                  ) {
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

                  setFormData((prev) => ({
                    ...prev,
                    vendor_name: val,
                    vendor_id: foundVendor ? foundVendor.id.toString() : '',
                    truck_id: prev.license_plate ? prev.truck_id : '',
                    license_plate: prev.license_plate ? prev.license_plate : '',
                    driver_name: prev.license_plate ? prev.driver_name : '',
                    length: prev.license_plate ? prev.length : '',
                    width: prev.license_plate ? prev.width : '',
                    height: prev.license_plate ? prev.height : '',
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
                onChange={(val) =>
                  handleNopolChange({ target: { name: 'license_plate', value: val } } as any)
                }
                required
                placeholder="Contoh: B 1234 CD"
                options={Array.from(
                  new Set([
                    ...(formData.vendor_id && vendorTrucks ? vendorTrucks : []),
                    ...trucksHistory,
                  ].map((t) => t.nopol))
                ).map((nopol) => {
                  const t =
                    trucksHistory.find((x: any) => x.nopol === nopol) ||
                    vendorTrucks?.find((x: any) => x.nopol === nopol);
                  return {
                    value: t.nopol,
                    label:
                      t.nama_supir || t.supir_default
                        ? `${t.nopol} (${t.nama_supir || t.supir_default})`
                        : t.nopol,
                  };
                })}
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
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Asal Tambang / Lokasi
              </label>
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
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Bruto (Kg)
                        </label>
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
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Tarra (Kg)
                        </label>
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
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Minus / Potongan (Kg)
                        </label>
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
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Panjang (P)
                        </label>
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
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Lebar (L)
                        </label>
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
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Tinggi (T)
                        </label>
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
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Minus Tinggi (m)
                        </label>
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
                      calcValue = Math.max(
                        0,
                        ((parseFloat(formData.gross_weight) || 0) -
                          (parseFloat(formData.tare_weight) || 0) -
                          (parseFloat(formData.minus_weight) || 0)) /
                          1000
                      );
                    } else {
                      const p = parseFloat(formData.length) || 0;
                      const l = parseFloat(formData.width) || 0;
                      const t = parseFloat(formData.height) || 0;
                      const mt = parseFloat(formData.minus_height) || 0;
                      calcValue =
                        Math.floor(((p * l * Math.max(0, t - mt)) / 1000000) * 100) / 100;
                    }
                    const isLarge =
                      measurementType === 'tonase' ? calcValue > 25 : calcValue > 20;
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
                              {measurementType === 'tonase'
                                ? '> 25 Ton → Tronton'
                                : '> 20 m³ → Tronton'}
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
                  <span className="text-sm font-medium text-emerald-800">Total Ritase:</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-bold text-emerald-600">1</span>
                    <span className="text-sm font-normal text-emerald-700">Rit / Trip</span>
                  </div>
                </div>
              )}

              {/* Tipe Kendaraan */}
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center justify-between">
                  <span>
                    Tipe Kendaraan{' '}
                    {measurementType === 'ritase' && <span className="text-red-500">*</span>}
                  </span>
                  {formData.truck_type && (
                    <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md font-medium border border-amber-200">
                      {lockedTruckType || measurementType === 'ritase'
                        ? '🔒 Terkunci dari Nopol'
                        : '✓ Terdeteksi Otomatis'}
                    </span>
                  )}
                </label>
                <CustomSelect
                  value={formData.truck_type}
                  onChange={(val) => handleTruckTypeChange(val as string)}
                  options={[
                    { value: '', label: '-- Pilih Tipe --' },
                    { value: 'tronton', label: 'Tronton' },
                    { value: 'colt_diesel', label: 'Colt Diesel' },
                  ]}
                />
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={createSuratJalan.isPending || updateSuratJalan.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors disabled:opacity-50"
            >
              {createSuratJalan.isPending || updateSuratJalan.isPending
                ? 'Menyimpan...'
                : 'Simpan Surat Jalan'}
            </button>
          </div>
        </form>
      </div>

      {migrationTarget && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Pindah Kepemilikan Armada</h3>
            <p className="text-sm text-gray-600 mb-4">
              Armada nopol <strong>{migrationTarget.nopol}</strong> dengan supir{' '}
              <strong>{migrationTarget.driver}</strong> ini sebelumnya milik{' '}
              <strong>{migrationTarget.oldVendorName}</strong>. Apakah Anda yakin ingin
              memindahkannya ke <strong>{migrationTarget.newVendorName}</strong>?
            </p>
            <div className="bg-amber-50 text-amber-800 text-xs p-3 rounded-xl border border-amber-200 mb-5">
              <p className="font-semibold mb-1">Jika Anda setuju:</p>
              <ol className="list-decimal pl-4 space-y-1">
                <li>Transaksi ini akan dicatat atas nama {migrationTarget.newVendorName}.</li>
                <li>
                  Sistem akan memindahkan kepemilikan armada di database secara permanen ke{' '}
                  {migrationTarget.newVendorName}.
                </li>
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
                    height: migrationTarget.height,
                  };
                  setFormData((prev) => ({
                    ...prev,
                    ...newFormData,
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
            setFormData((prev) => ({
              ...prev,
              [pendingFieldChange.name]: pendingFieldChange.value,
            }));
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

      <AlertModal
        isOpen={showTruckTypeAlert}
        onClose={() => {
          setShowTruckTypeAlert(false);
          setPendingTruckType(null);
        }}
        onConfirm={() => {
          if (pendingTruckType !== null) {
            setFormData((prev) => ({ ...prev, truck_type: pendingTruckType }));
            setLockedTruckType(pendingTruckType);
          }
          setShowTruckTypeAlert(false);
          setPendingTruckType(null);
        }}
        title="Ubah Tipe Kendaraan?"
        message={`Pilihan tipe kendaraan untuk nopol "${
          formData.license_plate
        }" sebelumnya terkunci sebagai "${
          formData.truck_type === 'tronton'
            ? 'Tronton'
            : formData.truck_type === 'colt_diesel'
            ? 'Colt Diesel'
            : formData.truck_type
        }". Apakah Anda yakin ingin mengubah pilihan tipe kendaraan ini menjadi "${
          pendingTruckType === 'tronton'
            ? 'Tronton'
            : pendingTruckType === 'colt_diesel'
            ? 'Colt Diesel'
            : 'Kosong'
        }"?`}
        confirmText="Ya, Ubah Tipe"
        cancelText="Batal"
        confirmColor="bg-amber-600 hover:bg-amber-700"
      />
    </div>
  );
}
