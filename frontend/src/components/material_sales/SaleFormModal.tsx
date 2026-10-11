import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { X, Loader2 } from 'lucide-react';
import apiClient from '../../api/apiClient';
import {
  useCreateIncomeRecord,
  useUpdateIncomeRecord,
  useAddCustomerTruck,
  IncomeRecord,
} from '../../hooks/useMaterialSales';
import { Customer } from '../../hooks/useProjects';
import { toLocalDateInput, formatNopol, formatTitleCase } from '../../utils/formatters';
import CustomSelect from '../CustomSelect';
import CustomCombobox from '../CustomCombobox';
import { MATERIAL_TYPES, VEHICLE_TYPES, UNITS } from './MaterialBadge';

const inputCls =
  'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300';

const todayStr = () => toLocalDateInput(new Date());

interface SaleFormModalProps {
  editData: IncomeRecord | null;
  onClose: () => void;
  customers: Customer[];
  projects: any[];
}

export default function SaleFormModal({
  editData,
  onClose,
  customers,
  projects,
}: SaleFormModalProps) {
  const [form, setForm] = useState({
    income_date: editData?.income_date ? editData.income_date.split('T')[0] : todayStr(),
    customer_name: editData?.customer_name || '',
    license_plate: editData?.license_plate || '',
    driver_name: editData?.driver_name || '',
    vehicle_type: editData?.vehicle_type || 'Colt Diesel',
    material_type: editData?.material_type || 'Limestone (urugan)',
    unit: editData?.unit || 'ritase',
    quantity: editData?.quantity?.toString() || '1',
    unit_price: editData?.unit_price?.toString() || '',
    amount: editData?.amount?.toString() || '',
    payment_method: editData?.payment_method || 'transfer',
    notes: editData?.notes || '',
    project_id: editData?.project_id ? String(editData.project_id) : '',
    sj_length: editData?.sj_length?.toString() || '',
    sj_width: editData?.sj_width?.toString() || '',
    sj_height: editData?.sj_height?.toString() || '',
    sj_volume_minus: editData?.sj_volume_minus?.toString() || '',
    sj_gross_weight: editData?.sj_gross_weight?.toString() || '',
    sj_tare_weight: editData?.sj_tare_weight?.toString() || '',
    sj_weight_minus: editData?.sj_weight_minus?.toString() || '',
  });

  const [saveTruckToCustomer, setSaveTruckToCustomer] = useState(true);
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [migrationTarget, setMigrationTarget] = useState<{
    nopol: string;
    driver: string;
    oldCustomerName: string;
    newCustomerName: string;
    vehicleType: string;
  } | null>(null);

  const createIncomeMutation = useCreateIncomeRecord();
  const updateIncomeMutation = useUpdateIncomeRecord();
  const addTruckMutation = useAddCustomerTruck();

  const isSaving = createIncomeMutation.isPending || updateIncomeMutation.isPending;

  const currentCust = useMemo(() => {
    return customers.find((c) => c.name === form.customer_name);
  }, [customers, form.customer_name]);

  const isNewTruck = useMemo(() => {
    if (!currentCust || !form.license_plate) return false;
    const hasTruck = (currentCust.trucks || []).some(
      (t) => t.license_plate.toUpperCase() === form.license_plate.toUpperCase()
    );
    return !hasTruck;
  }, [currentCust, form.license_plate]);

  useEffect(() => {
    if (form.unit === 'm3') {
      const p = parseFloat(form.sj_length) || 0;
      const l = parseFloat(form.sj_width) || 0;
      const t = parseFloat(form.sj_height) || 0;
      const m = parseFloat(form.sj_volume_minus) || 0;
      if (p > 0 && l > 0 && t > 0) {
        setForm((prev) => ({ ...prev, quantity: (p * l * (t - m)).toString() }));
      }
    } else if (form.unit === 'ton') {
      const gross = parseFloat(form.sj_gross_weight) || 0;
      const tare = parseFloat(form.sj_tare_weight) || 0;
      const m = parseFloat(form.sj_weight_minus) || 0;
      if (gross > 0) {
        setForm((prev) => ({ ...prev, quantity: (gross - tare - m).toString() }));
      }
    } else {
      setForm((prev) => ({ ...prev, quantity: '1' }));
    }
  }, [
    form.unit,
    form.sj_length,
    form.sj_width,
    form.sj_height,
    form.sj_volume_minus,
    form.sj_gross_weight,
    form.sj_tare_weight,
    form.sj_weight_minus,
  ]);

  useEffect(() => {
    const q = parseFloat(form.quantity) || 0;
    const p = parseFloat(form.unit_price) || 0;
    if (q > 0 && p > 0) {
      setForm((prev) => ({ ...prev, amount: (q * p).toString() }));
    }
  }, [form.quantity, form.unit_price]);

  useEffect(() => {
    const { material_type, unit, customer_name, vehicle_type } = form;
    if (!material_type || !unit) return;

    let cancelled = false;
    const lookup = async () => {
      try {
        const params = new URLSearchParams({ material_type, unit });
        if (customer_name.trim()) params.set('customer_name', customer_name.trim());
        if (vehicle_type) params.set('vehicle_type', vehicle_type);
        const res = await apiClient.get(`/material-prices/lookup?${params.toString()}`);
        if (cancelled) return;

        if (res.data?.found) {
          setForm((prev) => ({ ...prev, unit_price: String(res.data.price_per_unit) }));
        }
      } catch (err) {
        // ignore lookup errors
      }
    };

    const timer = setTimeout(lookup, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [form.material_type, form.unit, form.customer_name, form.vehicle_type]);

  const handleSubmit = async (
    e?: React.FormEvent,
    isMigrationConfirmed = false,
    migrationData?: any
  ) => {
    if (e) e.preventDefault();

    const finalForm = migrationData ? { ...form, ...migrationData } : form;
    let finalCustomerName = finalForm.customer_name;
    if (!isNewCustomer) {
      const exactCust = customers.find(
        (c) =>
          (c.name || '').toLowerCase().trim() ===
          (finalForm.customer_name || '').toLowerCase().trim()
      );
      if (!exactCust) {
        toast.error(
          "Nama pelanggan tidak cocok. Pastikan tidak salah ketik, atau pilih 'Pelanggan Baru'."
        );
        return;
      }
      finalCustomerName = exactCust.name; // Normalize
    }

    try {
      const payload: Partial<IncomeRecord> = {
        income_date: finalForm.income_date,
        income_type: 'material_sale',
        description: `Penjualan ${finalForm.material_type || 'Unknown'} - ${finalCustomerName}`,
        customer_name: finalCustomerName,
        license_plate: finalForm.license_plate,
        driver_name: finalForm.driver_name,
        vehicle_type: finalForm.vehicle_type,
        material_type: finalForm.material_type,
        quantity: parseFloat(finalForm.quantity) || 1,
        unit: finalForm.unit || 'ritase',
        unit_price: parseFloat(finalForm.unit_price) || 0,
        amount: (parseFloat(finalForm.quantity) || 1) * (parseFloat(finalForm.unit_price) || 0),
        payment_method: finalForm.payment_method || 'transfer',
        notes: finalForm.notes,
        project_id: finalForm.project_id ? parseInt(finalForm.project_id) : undefined,
        sj_length: finalForm.sj_length ? parseFloat(finalForm.sj_length) : undefined,
        sj_width: finalForm.sj_width ? parseFloat(finalForm.sj_width) : undefined,
        sj_height: finalForm.sj_height ? parseFloat(finalForm.sj_height) : undefined,
        sj_volume_minus: finalForm.sj_volume_minus
          ? parseFloat(finalForm.sj_volume_minus)
          : undefined,
        sj_gross_weight: finalForm.sj_gross_weight
          ? parseFloat(finalForm.sj_gross_weight)
          : undefined,
        sj_tare_weight: finalForm.sj_tare_weight
          ? parseFloat(finalForm.sj_tare_weight)
          : undefined,
        sj_weight_minus: finalForm.sj_weight_minus
          ? parseFloat(finalForm.sj_weight_minus)
          : undefined,
        migrate_truck: isMigrationConfirmed,
        old_customer_name:
          isMigrationConfirmed && migrationTarget ? migrationTarget.oldCustomerName : undefined,
      } as any;

      if (editData) {
        await updateIncomeMutation.mutateAsync({ id: editData.id, data: payload });
      } else {
        await createIncomeMutation.mutateAsync(payload);
      }

      if (isNewTruck && saveTruckToCustomer && currentCust) {
        try {
          await addTruckMutation.mutateAsync({
            customerId: currentCust.id,
            data: {
              license_plate: finalForm.license_plate.toUpperCase(),
              driver_name: finalForm.driver_name,
              vehicle_type: finalForm.vehicle_type,
            },
          });
        } catch (e) {
          console.error('Gagal simpan armada baru:', e);
        }
      }

      toast.success('Penjualan berhasil dicatat');
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || err.message || 'Gagal menyimpan penjualan');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold">{editData ? 'Edit Penjualan' : 'Catat Penjualan'}</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X size={18} />
          </button>
        </div>
        <form onSubmit={(e) => handleSubmit(e)} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tanggal</label>
              <input
                type="date"
                required
                value={form.income_date}
                onChange={(e) => setForm((p) => ({ ...p, income_date: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Pembeli / Customer</label>
              <div className="flex gap-4 mb-2">
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="radio"
                    checked={!isNewCustomer}
                    onChange={() => setIsNewCustomer(false)}
                    className="w-4 h-4 text-emerald-600"
                  />
                  Pelanggan Terdaftar
                </label>
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="radio"
                    checked={isNewCustomer}
                    onChange={() => {
                      setIsNewCustomer(true);
                      setForm((p) => ({ ...p, customer_name: '' }));
                    }}
                    className="w-4 h-4 text-emerald-600"
                  />
                  Pelanggan Baru
                </label>
              </div>
              {!isNewCustomer ? (
                <CustomCombobox
                  required
                  value={form.customer_name}
                  onChange={(val) => {
                    const foundCust = customers.find((c) => c.name === val);
                    if (
                      form.license_plate &&
                      currentCust &&
                      foundCust &&
                      currentCust.name !== foundCust.name
                    ) {
                      const truckInCurrent = (currentCust.trucks || []).find(
                        (t) => t.license_plate === form.license_plate
                      );
                      if (truckInCurrent) {
                        setMigrationTarget({
                          nopol: form.license_plate,
                          driver: form.driver_name,
                          oldCustomerName: currentCust.name,
                          newCustomerName: foundCust.name,
                          vehicleType: form.vehicle_type,
                        });
                        return;
                      }
                    }
                    setForm((p) => ({ ...p, customer_name: val }));
                  }}
                  placeholder="Pilih Pelanggan..."
                  options={customers
                    .slice()
                    .sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''))
                    .map((c: any) => ({
                      value: c.name,
                      label: c.name,
                    }))}
                />
              ) : (
                <input
                  type="text"
                  required
                  value={form.customer_name}
                  onChange={(e) => setForm((p) => ({ ...p, customer_name: e.target.value }))}
                  placeholder="Ketik nama pelanggan baru..."
                  className={inputCls}
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Plat Nomor</label>
              <CustomCombobox
                value={form.license_plate}
                onChange={(rawVal) => {
                  const val = formatNopol(rawVal);

                  let foundInOther: any = null;
                  let foundInCurrent: any = null;

                  for (const cust of customers) {
                    const truck = (cust.trucks || []).find(
                      (t) => t.license_plate.toUpperCase() === val
                    );
                    if (truck) {
                      if (currentCust && cust.name !== currentCust.name) {
                        foundInOther = { cust, truck };
                      } else if (currentCust && cust.name === currentCust.name) {
                        foundInCurrent = truck;
                      } else if (!currentCust) {
                        foundInOther = { cust, truck };
                      }
                    }
                  }

                  if (currentCust && foundInOther && !foundInCurrent) {
                    setMigrationTarget({
                      nopol: val,
                      driver: foundInOther.truck.driver_name || '',
                      oldCustomerName: foundInOther.cust.name,
                      newCustomerName: currentCust.name,
                      vehicleType: foundInOther.truck.vehicle_type || 'Colt Diesel',
                    });
                    return;
                  }

                  const targetCust = foundInCurrent
                    ? { cust: currentCust, truck: foundInCurrent }
                    : foundInOther;

                  setForm((p) => {
                    const newForm = { ...p, license_plate: val };
                    if (targetCust) {
                      newForm.customer_name = targetCust.cust.name;
                      newForm.driver_name = targetCust.truck.driver_name || '';
                      newForm.vehicle_type = targetCust.truck.vehicle_type || 'Colt Diesel';

                      const pref =
                        targetCust.cust.material_preferences?.find(
                          (m: any) => m.vehicle_type === newForm.vehicle_type
                        ) || targetCust.cust.material_preferences?.[0];
                      if (pref) {
                        newForm.material_type = pref.material_type;
                      }
                      newForm.unit = 'ritase';
                      newForm.quantity = '1';
                    }
                    return newForm;
                  });
                }}
                placeholder="Contoh: B 1234 CD"
                options={Array.from(
                  new Set([
                    ...(currentCust?.trucks || []),
                    ...customers.flatMap((c) => c.trucks || []),
                  ].map((t) => t.license_plate))
                ).map((plate) => {
                  const t =
                    currentCust?.trucks?.find((x) => x.license_plate === plate) ||
                    customers.flatMap((c) => c.trucks || []).find((x) => x.license_plate === plate);
                  return {
                    value: t?.license_plate || plate,
                    label: t?.driver_name
                      ? `${t?.license_plate} (${t?.driver_name})`
                      : t?.license_plate || plate,
                  };
                })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nama Supir</label>
              <input
                type="text"
                value={form.driver_name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, driver_name: formatTitleCase(e.target.value) }))
                }
                placeholder="Contoh: Budi"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Jenis Kendaraan
              </label>
              <CustomSelect
                value={form.vehicle_type}
                onChange={(val) => setForm((p) => ({ ...p, vehicle_type: val as string }))}
                options={VEHICLE_TYPES.map((v) => ({ value: v, label: v }))}
              />
            </div>
          </div>

          {isNewTruck && (
            <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 flex items-start gap-3">
              <input
                type="checkbox"
                id="saveNewTruck"
                checked={saveTruckToCustomer}
                onChange={(e) => setSaveTruckToCustomer(e.target.checked)}
                className="mt-1 w-4 h-4 text-emerald-600 rounded"
              />
              <div>
                <label
                  htmlFor="saveNewTruck"
                  className="text-sm font-semibold text-blue-800 cursor-pointer block mb-0.5"
                >
                  Simpan Kendaraan Baru
                </label>
                <p className="text-xs text-blue-600">
                  Nopol <span className="font-bold">{form.license_plate.toUpperCase()}</span> belum
                  ada di data armada <span className="font-bold">{form.customer_name}</span>. Centang
                  ini agar otomatis ditambahkan.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Material</label>
              <CustomSelect
                value={form.material_type}
                onChange={(val) => setForm((p) => ({ ...p, material_type: val as string }))}
                options={MATERIAL_TYPES.map((m) => ({ value: m, label: m }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Satuan <span className="text-red-500">*</span>
              </label>
              <CustomSelect
                value={form.unit}
                onChange={(val) =>
                  setForm((p) => ({
                    ...p,
                    unit: val as string,
                    quantity: val === 'ritase' ? '1' : p.quantity,
                  }))
                }
                options={UNITS.map((u) => ({
                  value: u,
                  label: u === 'm3' ? 'Kubikasi (m³)' : u === 'ton' ? 'Tonase (ton)' : 'Ritase',
                }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Harga / Satuan</label>
              <input
                type="number"
                required
                value={form.unit_price}
                onChange={(e) => setForm((p) => ({ ...p, unit_price: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Project <span className="text-xs font-normal text-gray-400">(opsional)</span>
              </label>
              <CustomSelect
                value={form.project_id}
                onChange={(val) => setForm((p) => ({ ...p, project_id: val as string }))}
                options={[
                  { value: '', label: '-- Tanpa Project (General) --' },
                  ...projects
                    .slice()
                    .sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''))
                    .map((p: any) => ({
                      value: String(p.id),
                      label: p.name,
                    })),
                ]}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border rounded-xl text-sm font-medium"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold disabled:opacity-60 flex justify-center items-center gap-2"
            >
              {isSaving && <Loader2 size={18} className="animate-spin" />}
              Simpan Penjualan
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
              <strong>{migrationTarget.driver}</strong> ini sebelumnya milik pelanggan{' '}
              <strong>{migrationTarget.oldCustomerName}</strong>. Apakah Anda yakin ingin
              memindahkannya ke <strong>{migrationTarget.newCustomerName}</strong>?
            </p>
            <div className="bg-amber-50 text-amber-800 text-xs p-3 rounded-xl border border-amber-200 mb-5">
              <p className="font-semibold mb-1">Jika Anda setuju:</p>
              <ol className="list-decimal pl-4 space-y-1">
                <li>Transaksi ini akan dicatat atas nama {migrationTarget.newCustomerName}.</li>
                <li>
                  Sistem akan memindahkan kepemilikan armada di database secara permanen ke{' '}
                  {migrationTarget.newCustomerName}.
                </li>
                <li>Data armada akan dihapus dari profil {migrationTarget.oldCustomerName}.</li>
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
                    customer_name: migrationTarget.newCustomerName,
                    vehicle_type: migrationTarget.vehicleType,
                  };
                  setForm((prev) => ({
                    ...prev,
                    ...newFormData,
                  }));
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
    </div>
  );
}
