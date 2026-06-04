import React, { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, X, Loader2, ShoppingCart, Settings, Truck
} from "lucide-react";
import apiClient from "../api/apiClient";
import { useCurrentUser } from "../hooks/useAuth";
import {
  useIncomeRecords, useMaterialPrices, useCreateIncomeRecord,
  useUpdateIncomeRecord, useDeleteIncomeRecord, useCreateMaterialPrice,
  useUpdateMaterialPrice, useDeleteMaterialPrice, useAddCustomerTruck,
  IncomeRecord, MaterialPrice
} from "../hooks/useMaterialSales";
import { useCustomersList, useProjectsList, Customer } from "../hooks/useProjects";
import { toLocalDateInput } from "../utils/formatters";

// ── Helpers ───────────────────────────────────────────────────────────────────
const formatIDR = (v?: number | string | null) =>
  Number(v ?? 0).toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  });

const formatDate = (d?: string | null) => {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
  });
};

const todayStr = () => {
  return toLocalDateInput(new Date());
};

const inputCls = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300";

const MATERIAL_TYPES = ["Limestone (urugan)", "Dolomite", "Boulder", "Clay"];
const VEHICLE_TYPES = ["Colt Diesel", "Tronton"];
const UNITS = ["ritase", "m3", "ton"];

// ── Components ─────────────────────────────────────────────────────────────────
const MaterialBadge = ({ type }: { type?: string }) => {
  let bg = "bg-emerald-50"; let text = "text-emerald-700"; let dot = "bg-emerald-400";
  if (type === "Limestone (urugan)") { bg = "bg-amber-50"; text = "text-amber-700"; dot = "bg-amber-400"; }
  if (type === "Dolomite") { bg = "bg-blue-50"; text = "text-blue-700"; dot = "bg-blue-400"; }
  if (type === "Boulder") { bg = "bg-stone-50"; text = "text-stone-700"; dot = "bg-stone-400"; }
  if (type === "Clay") { bg = "bg-orange-50"; text = "text-orange-700"; dot = "bg-orange-400"; }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${bg} ${text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {type || "Unknown"}
    </span>
  );
};

// ── Modals ─────────────────────────────────────────────────────────────────────
const SaleFormModal = ({
  editData, onClose, customers, projects
}: {
  editData: IncomeRecord | null, onClose: () => void,
  customers: Customer[], projects: any[]
}) => {
  const [form, setForm] = useState({
    income_date: editData?.income_date ? editData.income_date.split("T")[0] : todayStr(),
    customer_name: editData?.customer_name || "",
    license_plate: editData?.license_plate || "",
    driver_name: editData?.driver_name || "",
    vehicle_type: editData?.vehicle_type || "Colt Diesel",
    material_type: editData?.material_type || "Limestone (urugan)",
    unit: editData?.unit || "ritase",
    quantity: editData?.quantity?.toString() || "1",
    unit_price: editData?.unit_price?.toString() || "",
    amount: editData?.amount?.toString() || "",
    payment_method: editData?.payment_method || "transfer",
    notes: editData?.notes || "",
    project_id: editData?.project_id ? String(editData.project_id) : "",
    sj_length: editData?.sj_length?.toString() || "",
    sj_width: editData?.sj_width?.toString() || "",
    sj_height: editData?.sj_height?.toString() || "",
    sj_volume_minus: editData?.sj_volume_minus?.toString() || "",
    sj_gross_weight: editData?.sj_gross_weight?.toString() || "",
    sj_tare_weight: editData?.sj_tare_weight?.toString() || "",
    sj_weight_minus: editData?.sj_weight_minus?.toString() || "",
  });

  const [saveTruckToCustomer, setSaveTruckToCustomer] = useState(true);

  const createIncomeMutation = useCreateIncomeRecord();
  const updateIncomeMutation = useUpdateIncomeRecord();
  const addTruckMutation = useAddCustomerTruck();

  const isSaving = createIncomeMutation.isPending || updateIncomeMutation.isPending;

  const currentCust = useMemo(() => {
    return customers.find(c => c.name === form.customer_name);
  }, [customers, form.customer_name]);

  const isNewTruck = useMemo(() => {
    if (!currentCust || !form.license_plate) return false;
    const hasTruck = (currentCust.trucks || []).some(t => t.license_plate.toUpperCase() === form.license_plate.toUpperCase());
    return !hasTruck;
  }, [currentCust, form.license_plate]);

  useEffect(() => {
    if (form.unit === "m3") {
      const p = parseFloat(form.sj_length) || 0;
      const l = parseFloat(form.sj_width) || 0;
      const t = parseFloat(form.sj_height) || 0;
      const m = parseFloat(form.sj_volume_minus) || 0;
      if (p > 0 && l > 0 && t > 0) {
        setForm(prev => ({ ...prev, quantity: (p * l * (t - m)).toString() }));
      }
    } else if (form.unit === "ton") {
      const gross = parseFloat(form.sj_gross_weight) || 0;
      const tare = parseFloat(form.sj_tare_weight) || 0;
      const m = parseFloat(form.sj_weight_minus) || 0;
      if (gross > 0) {
        setForm(prev => ({ ...prev, quantity: (gross - tare - m).toString() }));
      }
    } else {
      setForm(prev => ({ ...prev, quantity: "1" }));
    }
  }, [form.unit, form.sj_length, form.sj_width, form.sj_height, form.sj_volume_minus, form.sj_gross_weight, form.sj_tare_weight, form.sj_weight_minus]);

  useEffect(() => {
    const q = parseFloat(form.quantity) || 0;
    const p = parseFloat(form.unit_price) || 0;
    if (q > 0 && p > 0) {
      setForm(prev => ({ ...prev, amount: (q * p).toString() }));
    }
  }, [form.quantity, form.unit_price]);

  useEffect(() => {
    const { material_type, unit, customer_name, vehicle_type } = form;
    if (!material_type || !unit) return;
    
    let cancelled = false;
    const lookup = async () => {
      try {
        const params = new URLSearchParams({ material_type, unit });
        if (customer_name.trim()) params.set("customer_name", customer_name.trim());
        if (vehicle_type) params.set("vehicle_type", vehicle_type);
        const res = await apiClient.get(`/material-prices/lookup?${params.toString()}`);
        if (cancelled) return;
        
        if (res.data?.found) {
          setForm(prev => ({ ...prev, unit_price: String(res.data.price_per_unit) }));
        }
      } catch (err) {
        // ignore lookup errors
      }
    };
    
    const timer = setTimeout(lookup, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [form.material_type, form.unit, form.customer_name, form.vehicle_type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: Partial<IncomeRecord> = {
        income_date: form.income_date,
        income_type: "material_sale",
        description: `Penjualan ${form.material_type || "Unknown"} - ${form.customer_name}`,
        customer_name: form.customer_name,
        license_plate: form.license_plate,
        driver_name: form.driver_name,
        vehicle_type: form.vehicle_type,
        material_type: form.material_type,
        quantity: parseFloat(form.quantity) || 1,
        unit: form.unit || "ritase",
        unit_price: parseFloat(form.unit_price) || 0,
        amount: (parseFloat(form.quantity) || 1) * (parseFloat(form.unit_price) || 0),
        payment_method: form.payment_method || "transfer",
        notes: form.notes,
        project_id: form.project_id ? parseInt(form.project_id) : undefined,
        sj_length: form.sj_length ? parseFloat(form.sj_length) : undefined,
        sj_width: form.sj_width ? parseFloat(form.sj_width) : undefined,
        sj_height: form.sj_height ? parseFloat(form.sj_height) : undefined,
        sj_volume_minus: form.sj_volume_minus ? parseFloat(form.sj_volume_minus) : undefined,
        sj_gross_weight: form.sj_gross_weight ? parseFloat(form.sj_gross_weight) : undefined,
        sj_tare_weight: form.sj_tare_weight ? parseFloat(form.sj_tare_weight) : undefined,
        sj_weight_minus: form.sj_weight_minus ? parseFloat(form.sj_weight_minus) : undefined,
      };

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
              license_plate: form.license_plate.toUpperCase(),
              driver_name: form.driver_name,
              vehicle_type: form.vehicle_type
            }
          });
        } catch (e) {
          console.error("Gagal simpan armada baru:", e);
        }
      }

      toast.success("Penjualan berhasil dicatat");
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || err.message || "Gagal menyimpan penjualan");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold">{editData ? "Edit Penjualan" : "Catat Penjualan"}</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tanggal</label>
              <input type="date" required value={form.income_date} onChange={e => setForm(p => ({...p, income_date: e.target.value}))} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Pembeli / Customer</label>
              <input 
                type="text" 
                required 
                list="customers-list"
                value={form.customer_name} 
                onChange={e => setForm(p => ({...p, customer_name: e.target.value}))} 
                placeholder="Pilih atau ketik baru..."
                className={inputCls} 
              />
              <datalist id="customers-list">
                {customers.slice().sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '')).map((c: any) => <option key={c.id} value={c.name} />)}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Plat Nomor</label>
              <input 
                type="text" 
                list="trucks-list"
                value={form.license_plate} 
                onChange={e => {
                  const val = e.target.value.toUpperCase();
                  setForm(p => {
                    const newForm = {...p, license_plate: val};
                    for (const cust of customers) {
                      if (cust.trucks) {
                        const truck = cust.trucks.find(t => t.license_plate.toUpperCase() === val);
                        if (truck) {
                          newForm.customer_name = cust.name;
                          newForm.driver_name = truck.driver_name || "";
                          newForm.vehicle_type = truck.vehicle_type || "Colt Diesel";
                          
                          const pref = cust.material_preferences?.find(m => m.vehicle_type === newForm.vehicle_type) || cust.material_preferences?.[0];
                          if (pref) {
                            newForm.material_type = pref.material_type;
                          }
                          newForm.unit = "ritase";
                          newForm.quantity = "1";
                          break;
                        }
                      }
                    }
                    return newForm;
                  });
                }} 
                placeholder="Nopol Truk..."
                className={inputCls} 
              />
              <datalist id="trucks-list">
                {currentCust ? (currentCust.trucks || []).map(t => (
                  <option key={t.license_plate} value={t.license_plate}>{t.license_plate}</option>
                )) : null}
              </datalist>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nama Supir</label>
              <input 
                type="text" 
                value={form.driver_name} 
                onChange={e => setForm(p => ({...p, driver_name: e.target.value}))} 
                placeholder="Nama Supir..."
                className={inputCls} 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Jenis Kendaraan</label>
              <select value={form.vehicle_type} onChange={e => setForm(p => ({...p, vehicle_type: e.target.value}))} className={inputCls} required>
                {VEHICLE_TYPES.map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          {isNewTruck && (
            <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 flex items-start gap-3">
              <input 
                type="checkbox" 
                id="saveNewTruck" 
                checked={saveTruckToCustomer} 
                onChange={e => setSaveTruckToCustomer(e.target.checked)} 
                className="mt-1 w-4 h-4 text-emerald-600 rounded"
              />
              <div>
                <label htmlFor="saveNewTruck" className="text-sm font-semibold text-blue-800 cursor-pointer block mb-0.5">
                  Simpan Kendaraan Baru
                </label>
                <p className="text-xs text-blue-600">
                  Nopol <span className="font-bold">{form.license_plate.toUpperCase()}</span> belum ada di data armada <span className="font-bold">{form.customer_name}</span>. Centang ini agar otomatis ditambahkan.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Material</label>
              <select value={form.material_type} onChange={e => setForm(p => ({...p, material_type: e.target.value}))} className={inputCls} required>
                {MATERIAL_TYPES.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Satuan <span className="text-red-500">*</span></label>
              <select
                value={form.unit}
                onChange={e => setForm(p => ({ ...p, unit: e.target.value, quantity: e.target.value === 'ritase' ? '1' : p.quantity }))}
                className={inputCls}
                required
              >
                {UNITS.map(u => (
                  <option key={u} value={u}>{u === 'm3' ? 'Kubikasi (m³)' : u === 'ton' ? 'Tonase (ton)' : 'Ritase'}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Harga / Satuan</label>
              <input type="number" required value={form.unit_price} onChange={e => setForm(p => ({...p, unit_price: e.target.value}))} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Project <span className="text-xs font-normal text-gray-400">(opsional)</span></label>
              <select
                value={form.project_id}
                onChange={e => setForm(p => ({...p, project_id: e.target.value}))}
                className={inputCls}
              >
                <option value="">-- Tanpa Project (General) --</option>
                  {projects.slice().sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '')).map((p: any) => (
                    <option key={p.id} value={String(p.id)}>{p.name}</option>
                  ))}
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border rounded-xl text-sm font-medium">Batal</button>
            <button type="submit" disabled={isSaving} className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold disabled:opacity-60 flex justify-center items-center gap-2">
              {isSaving && <Loader2 size={18} className="animate-spin" />}
              Simpan Penjualan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


const PriceFormModal = ({ editData, onClose }: { editData: MaterialPrice | null, onClose: () => void }) => {
  const [form, setForm] = useState({
    material_type: editData?.material_type || "Limestone (urugan)",
    unit: editData?.unit || "ritase",
    vehicle_type: editData?.vehicle_type || "",
    price_per_unit: editData?.price_per_unit?.toString() || "",
    is_active: editData?.is_active ?? true,
    notes: editData?.notes || "",
  });

  const createMutation = useCreateMaterialPrice();
  const updateMutation = useUpdateMaterialPrice();
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const body: Partial<MaterialPrice> = {
        ...form,
        vehicle_type: form.vehicle_type === "" ? undefined : form.vehicle_type,
        price_per_unit: parseFloat(form.price_per_unit),
      };
      if (editData) {
        await updateMutation.mutateAsync({ id: editData.id, data: body });
      } else {
        await createMutation.mutateAsync(body);
      }
      toast.success("Harga berhasil disimpan");
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Gagal menyimpan harga");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold">{editData ? "Edit Harga" : "Tambah Harga"}</h2>
          <button onClick={onClose} className="p-2"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Material</label>
              <select value={form.material_type} onChange={(e) => {
                setForm(p => ({...p, material_type: e.target.value, unit: "ritase"}));
              }} className={inputCls}>
                {MATERIAL_TYPES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Jenis Kendaraan</label>
              <select value={form.vehicle_type} onChange={e => setForm(p => ({...p, vehicle_type: e.target.value}))} className={inputCls}>
                <option value="">Semua Kendaraan</option>
                {VEHICLE_TYPES.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Satuan</label>
              <select value={form.unit} onChange={(e) => setForm(p => ({ ...p, unit: e.target.value }))} className={inputCls}>
                <option value="ritase">Ritase</option>
                <option value="m3">Kubikasi (m³)</option>
                <option value="ton">Tonase (ton)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Harga / Satuan (Rp)</label>
              <input
                type="number" required min={0} placeholder="Contoh: 150000"
                value={form.price_per_unit}
                onChange={(e) => setForm(p => ({ ...p, price_per_unit: e.target.value }))}
                className={inputCls}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="is_active" checked={form.is_active} onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))} className="w-4 h-4 rounded text-emerald-600" />
            <label htmlFor="is_active" className="text-sm">Aktif</label>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 border rounded-xl text-sm">Batal</button>
            <button type="submit" disabled={isSaving} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold flex justify-center items-center gap-2 transition-colors">
              {isSaving && <Loader2 className="animate-spin" size={16}/>} Simpan Harga
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


const SaleDetailModal = ({ sale, isGM, currentUser, onClose, onEdit, onDelete }: any) => {
  const canEdit = isGM || sale.created_by === currentUser?.id;
  const rows = [
    { label: "Tanggal",         value: formatDate(sale.income_date) },
    { label: "Customer",        value: sale.customer_name || "-" },
    { label: "Plat Nomor",      value: sale.license_plate || "-" },
    { label: "Nama Supir",      value: sale.driver_name || "-" },
    { label: "Jenis Kendaraan", value: sale.vehicle_type || "-" },
    { label: "Material",        value: <MaterialBadge type={sale.material_type} /> },
    { label: "Volume",          value: `${Number(sale.quantity).toLocaleString("id-ID")} ${sale.unit}` },
    { label: "Harga / Satuan",  value: formatIDR(sale.unit_price) },
    { label: "Total",           value: <span className="text-emerald-700 font-bold text-base">{formatIDR(sale.amount)}</span> },
    { label: "Pembayaran",      value: <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sale.payment_method === "cash" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>{sale.payment_method === "cash" ? "Cash" : "Transfer"}</span> },
    ...(sale.notes ? [{ label: "Catatan", value: sale.notes }] : []),
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ShoppingCart size={18} className="text-emerald-600" />
            <h2 className="text-base font-semibold text-gray-800">Detail Penjualan</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-3">
          {rows.map(({ label, value }) => (
            <div key={label} className="flex items-start justify-between gap-4">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide w-32 shrink-0 pt-0.5">{label}</span>
              <span className="text-sm text-gray-800 text-right">{value}</span>
            </div>
          ))}
        </div>
        {canEdit && (
          <div className="flex gap-3 px-6 pb-5 pt-2 border-t border-gray-50">
            <button onClick={onDelete} className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-sm font-semibold transition-colors">
              <Trash2 size={15} /> Hapus
            </button>
            <button onClick={onEdit} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors">
              <Pencil size={15} /> Edit
            </button>
          </div>
        )}
      </div>
    </div>
  );
};


// ── MAIN COMPONENT ─────────────────────────────────────────────────────────────
export default function MaterialSalesPage() {
  const [activeTab, setActiveTab] = useState<"sales" | "prices">("sales");
  const { data: currentUser } = useCurrentUser();
  
  const { data: sales = [], isLoading: loadingSales } = useIncomeRecords({ income_type: "material_sale" }, { enabled: activeTab === "sales" });
  const { data: prices = [], isLoading: loadingPrices } = useMaterialPrices(undefined, { enabled: activeTab === "prices" });

  const { data: customers = [] } = useCustomersList();
  const { data: projects = [] } = useProjectsList();

  const deleteIncomeMutation = useDeleteIncomeRecord();
  const deletePriceMutation = useDeleteMaterialPrice();

  const [showSaleModal, setShowSaleModal] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [editDataSale, setEditDataSale] = useState<IncomeRecord | null>(null);
  const [editDataPrice, setEditDataPrice] = useState<MaterialPrice | null>(null);
  const [viewSale, setViewSale] = useState<IncomeRecord | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<any>(null);

  const isGM = currentUser?.is_admin || currentUser?.is_superuser || ["gm", "admin"].includes(currentUser?.role || "");
  const isLoading = activeTab === "sales" ? loadingSales : loadingPrices;

  const handleDelete = async () => {
    try {
      if (activeTab === "sales") {
        await deleteIncomeMutation.mutateAsync(confirmDelete.id);
      } else {
        await deletePriceMutation.mutateAsync(confirmDelete.id);
      }
      toast.success("Berhasil dihapus");
    } catch {
      toast.error("Gagal menghapus");
    }
    setConfirmDelete(null);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Penjualan Material</h1>
          <p className="text-sm text-gray-500 mt-1">Catat transaksi material & kelola harga</p>
        </div>
        <div className="flex gap-2">
          {isGM && (
            <button
              onClick={() => setActiveTab(t => t === "sales" ? "prices" : "sales")}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 ${activeTab === "prices" ? "bg-indigo-100 text-indigo-700" : "bg-white border text-gray-600 hover:bg-gray-50"}`}
            >
              <Settings size={16} /> Atur Harga (GM)
            </button>
          )}
          {activeTab === "sales" && (
            <button
              onClick={() => { setEditDataSale(null); setShowSaleModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
            >
              <Plus size={16} /> Catat Penjualan
            </button>
          )}
          {activeTab === "prices" && (
            <button
              onClick={() => { setEditDataPrice(null); setShowPriceModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
            >
              <Plus size={16} /> Tambah Harga
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[400px]">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
        ) : activeTab === "sales" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b whitespace-nowrap">
                <tr>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Tanggal</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Customer</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Kendaraan</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Material</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Volume</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Total (Rp)</th>
                  <th className="px-4 py-3 text-center w-8 whitespace-nowrap"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sales.map(s => (
                  <tr
                    key={s.id}
                    onClick={() => setViewSale(s)}
                    className="hover:bg-emerald-50/60 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(s.income_date)}</td>
                    <td className="px-4 py-3 font-medium whitespace-nowrap">{s.customer_name}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                      <div className="flex items-center gap-1.5"><Truck size={12}/> {s.license_plate || "-"}</div>
                      <div className="mt-0.5 text-gray-400">{s.vehicle_type || "-"} • {s.driver_name || "Tanpa Supir"}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap"><MaterialBadge type={s.material_type} /></td>
                    <td className="px-4 py-3 text-right font-medium whitespace-nowrap">{s.quantity} {s.unit}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-700 whitespace-nowrap">{formatIDR(s.amount)}</td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <span className="text-gray-300 text-xs">›</span>
                    </td>
                  </tr>
                ))}
                {sales.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-gray-400">Belum ada catatan penjualan material.</td></tr>}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-indigo-50 border-b whitespace-nowrap">
                <tr>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Material</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Kendaraan</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Tipe Harga</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Satuan</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Harga</th>
                  <th className="px-4 py-3 text-center whitespace-nowrap">Status</th>
                  {isGM && <th className="px-4 py-3 text-center whitespace-nowrap">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {prices.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap"><MaterialBadge type={p.material_type} /></td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{p.vehicle_type ? <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-medium">{p.vehicle_type}</span> : <span className="text-gray-400 italic text-xs">Semua</span>}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-emerald-600 text-xs font-bold bg-emerald-50 px-2 py-1 rounded">Harga Default</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        p.unit === 'm3' ? 'bg-blue-50 text-blue-700' :
                        p.unit === 'ton' ? 'bg-orange-50 text-orange-700' :
                        'bg-purple-50 text-purple-700'
                      }`}>
                        {p.unit === 'm3' ? '📐 Kubikasi (m³)' : p.unit === 'ton' ? '⚖️ Tonase (ton)' : '🚚 Ritase'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-800 whitespace-nowrap">{formatIDR(p.price_per_unit)}</td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {p.is_active ? <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">Aktif</span> : <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs">Nonaktif</span>}
                    </td>
                    {isGM && (
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <button onClick={() => { setEditDataPrice(p); setShowPriceModal(true); }} className="p-1 text-blue-500 hover:bg-blue-50 rounded"><Pencil size={15} /></button>
                        <button onClick={() => setConfirmDelete(p)} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 size={15} /></button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showSaleModal && <SaleFormModal editData={editDataSale} onClose={() => setShowSaleModal(false)} customers={customers} projects={projects} />}
      {showPriceModal && <PriceFormModal editData={editDataPrice} onClose={() => setShowPriceModal(false)} />}

      {/* Sale Detail Modal */}
      {viewSale && !showSaleModal && (
        <SaleDetailModal
          sale={viewSale}
          isGM={isGM}
          currentUser={currentUser}
          onClose={() => setViewSale(null)}
          onEdit={() => {
            setEditDataSale(viewSale);
            setViewSale(null);
            setShowSaleModal(true);
          }}
          onDelete={() => {
            setConfirmDelete(viewSale);
            setViewSale(null);
          }}
        />
      )}

      {/* Confirm Delete Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm text-center">
            <Trash2 size={32} className="text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-800 mb-2">Hapus Data?</h3>
            <p className="text-sm text-gray-500 mb-6">Data yang dihapus tidak dapat dikembalikan.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2 border rounded-xl text-sm font-medium">Batal</button>
              <button onClick={handleDelete} className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2">
                {(deleteIncomeMutation.isPending || deletePriceMutation.isPending) && <Loader2 size={16} className="animate-spin" />}
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
