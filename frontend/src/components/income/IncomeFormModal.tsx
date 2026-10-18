import React, { useState, useEffect } from "react";
import { X, DollarSign, ShoppingCart, Loader2 } from "lucide-react";
import CustomSelect from "../CustomSelect";
import CustomCombobox from "../CustomCombobox";
import apiClient from "../../api/apiClient";
import { toLocalDateInput } from "../../utils/formatters";
import { IncomeRecord } from "../../hooks/useMaterialSales";

const PAYMENT_TERMS = ["dp", "termin_1", "termin_2", "pelunasan", "lain-lain"];
const MATERIAL_TYPES = [
  "Limestone (urugan)",
  "Dolomite",
  "Boulder",
  "Clay",
];

interface IncomeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editId: number | null;
  editRecord?: IncomeRecord | null;
  projects: any[];
  customers: any[];
  onSubmit: (formData: any, tab: "project_payment" | "material_sale") => Promise<void>;
  isSaving: boolean;
}

export const IncomeFormModal: React.FC<IncomeFormModalProps> = ({
  isOpen,
  onClose,
  editId,
  editRecord,
  projects,
  customers,
  onSubmit,
  isSaving,
}) => {
  const [modalTab, setModalTab] = useState<"project_payment" | "material_sale">("project_payment");
  const [isNewCustomer, setIsNewCustomer] = useState(false);

  const todayStr = () => toLocalDateInput(new Date());

  const [projectForm, setProjectForm] = useState({
    income_date: todayStr(),
    project_id: "",
    payment_term: "dp",
    amount: "",
    payment_method: "transfer",
    description: "",
    notes: "",
  });

  const [materialForm, setMaterialForm] = useState({
    income_date: todayStr(),
    customer_name: "",
    material_type: MATERIAL_TYPES[0],
    quantity: "1",
    unit: "ritase",
    unit_price: "",
    amount: "",
    payment_method: "transfer",
    description: "",
    notes: "",
    project_id: "",
    sj_length: "",
    sj_width: "",
    sj_height: "",
    sj_volume_minus: "",
    sj_gross_weight: "",
    sj_tare_weight: "",
    sj_weight_minus: "",
  });

  // Populate on edit
  useEffect(() => {
    if (editRecord && editId) {
      if (editRecord.income_type === "project_payment") {
        setModalTab("project_payment");
        setProjectForm({
          income_date: editRecord.income_date ? toLocalDateInput(new Date(editRecord.income_date)) : todayStr(),
          project_id: editRecord.project_id ? String(editRecord.project_id) : "",
          payment_term: editRecord.payment_term || "dp",
          amount: editRecord.amount ? String(editRecord.amount) : "",
          payment_method: editRecord.payment_method || "transfer",
          description: editRecord.description || "",
          notes: editRecord.notes || "",
        });
      } else {
        setModalTab("material_sale");
        setMaterialForm({
          income_date: editRecord.income_date ? toLocalDateInput(new Date(editRecord.income_date)) : todayStr(),
          customer_name: editRecord.customer_name || "",
          material_type: editRecord.material_type || MATERIAL_TYPES[0],
          quantity: editRecord.quantity ? String(editRecord.quantity) : "1",
          unit: editRecord.unit || "ritase",
          unit_price: editRecord.unit_price ? String(editRecord.unit_price) : "",
          amount: editRecord.amount ? String(editRecord.amount) : "",
          payment_method: editRecord.payment_method || "transfer",
          description: editRecord.description || "",
          notes: editRecord.notes || "",
          project_id: editRecord.project_id ? String(editRecord.project_id) : "",
          sj_length: (editRecord as any).sj_length ? String((editRecord as any).sj_length) : "",
          sj_width: (editRecord as any).sj_width ? String((editRecord as any).sj_width) : "",
          sj_height: (editRecord as any).sj_height ? String((editRecord as any).sj_height) : "",
          sj_volume_minus: (editRecord as any).sj_volume_minus ? String((editRecord as any).sj_volume_minus) : "",
          sj_gross_weight: (editRecord as any).sj_gross_weight ? String((editRecord as any).sj_gross_weight) : "",
          sj_tare_weight: (editRecord as any).sj_tare_weight ? String((editRecord as any).sj_tare_weight) : "",
          sj_weight_minus: (editRecord as any).sj_weight_minus ? String((editRecord as any).sj_weight_minus) : "",
        });
      }
    } else {
      setProjectForm({
        income_date: todayStr(),
        project_id: "",
        payment_term: "dp",
        amount: "",
        payment_method: "transfer",
        description: "",
        notes: "",
      });
      setMaterialForm({
        income_date: todayStr(),
        customer_name: "",
        material_type: MATERIAL_TYPES[0],
        quantity: "1",
        unit: "ritase",
        unit_price: "",
        amount: "",
        payment_method: "transfer",
        description: "",
        notes: "",
        project_id: "",
        sj_length: "",
        sj_width: "",
        sj_height: "",
        sj_volume_minus: "",
        sj_gross_weight: "",
        sj_tare_weight: "",
        sj_weight_minus: "",
      });
      setIsNewCustomer(false);
    }
  }, [editRecord, editId, isOpen]);

  // Auto-fill description for project
  useEffect(() => {
    if (editId || !projectForm.project_id || !projectForm.payment_term) return;
    const proj = projects.find((p: any) => String(p.id) === String(projectForm.project_id));
    if (!proj) return;
    const termMap: Record<string, string> = {
      dp: "DP",
      termin_1: "Termin 1",
      termin_2: "Termin 2",
      pelunasan: "Pelunasan",
      "lain-lain": "Lain-lain",
    };
    const termLabel = termMap[projectForm.payment_term] ?? projectForm.payment_term;
    setProjectForm((prev) => ({
      ...prev,
      description: `${termLabel} - ${proj.name ?? ""}`,
    }));
  }, [projectForm.project_id, projectForm.payment_term, projects, editId]);

  // Auto calculate quantity
  useEffect(() => {
    if (materialForm.unit === "m3") {
      const p = parseFloat(materialForm.sj_length) || 0;
      const l = parseFloat(materialForm.sj_width) || 0;
      const t = parseFloat(materialForm.sj_height) || 0;
      const m = parseFloat(materialForm.sj_volume_minus) || 0;
      if (p > 0 && l > 0 && t > 0) {
        setMaterialForm((prev) => ({ ...prev, quantity: (p * l * (t - m)).toFixed(2) }));
      }
    } else if (materialForm.unit === "ton") {
      const gross = parseFloat(materialForm.sj_gross_weight) || 0;
      const tare = parseFloat(materialForm.sj_tare_weight) || 0;
      const m = parseFloat(materialForm.sj_weight_minus) || 0;
      if (gross > 0) {
        setMaterialForm((prev) => ({ ...prev, quantity: (gross - tare - m).toFixed(2) }));
      }
    }
  }, [
    materialForm.unit,
    materialForm.sj_length,
    materialForm.sj_width,
    materialForm.sj_height,
    materialForm.sj_volume_minus,
    materialForm.sj_gross_weight,
    materialForm.sj_tare_weight,
    materialForm.sj_weight_minus,
  ]);

  // Auto-calculate amount = qty × unit_price
  useEffect(() => {
    const qty = parseFloat(materialForm.quantity);
    const price = parseFloat(materialForm.unit_price);
    if (!isNaN(qty) && !isNaN(price) && qty > 0 && price > 0) {
      setMaterialForm((prev) => ({ ...prev, amount: String(Math.round(qty * price)) }));
    }
  }, [materialForm.quantity, materialForm.unit_price]);

  // Auto-lookup price
  useEffect(() => {
    const { material_type, unit, customer_name } = materialForm;
    if (!material_type || !unit) return;
    let cancelled = false;
    const lookup = async () => {
      try {
        const params = new URLSearchParams({ material_type, unit });
        if (customer_name.trim()) params.set("customer_name", customer_name.trim());
        const res = await apiClient.get(`/material-prices/lookup?${params}`);
        if (cancelled) return;
        if (res.data?.found) {
          setMaterialForm((prev) => ({ ...prev, unit_price: String(res.data.price_per_unit) }));
        }
      } catch {
        // ignore
      }
    };
    const timer = setTimeout(lookup, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [materialForm.material_type, materialForm.unit, materialForm.customer_name]);

  if (!isOpen) return null;

  const inputCls = (ring = "blue") =>
    `w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-${ring}-300 transition-all`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = modalTab === "project_payment" ? projectForm : materialForm;
    onSubmit(data, modalTab);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 className="text-lg font-semibold text-gray-800">
            {editId ? "Edit Pemasukan" : "Tambah Pemasukan"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!editId && (
          <div className="flex gap-2 px-6 pt-4">
            <button
              type="button"
              onClick={() => setModalTab("project_payment")}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                modalTab === "project_payment"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <DollarSign size={16} /> Pembayaran Proyek
              </div>
            </button>
            <button
              type="button"
              onClick={() => setModalTab("material_sale")}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                modalTab === "material_sale"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <ShoppingCart size={16} /> Penjualan Material
              </div>
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {modalTab === "project_payment" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tanggal <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={projectForm.income_date}
                  onChange={(e) => setProjectForm((p) => ({ ...p, income_date: e.target.value }))}
                  className={inputCls("blue")}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Proyek <span className="text-red-500">*</span>
                </label>
                <CustomSelect
                  required
                  value={projectForm.project_id}
                  onChange={(val) => setProjectForm((p) => ({ ...p, project_id: val as string }))}
                  options={[
                    { value: "", label: "-- Pilih Proyek --" },
                    ...projects.map((p: any) => ({ value: String(p.id), label: p.name })),
                  ]}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Termin Pembayaran</label>
                <CustomSelect
                  value={projectForm.payment_term}
                  onChange={(val) => setProjectForm((p) => ({ ...p, payment_term: val as string }))}
                  options={PAYMENT_TERMS.map((t) => ({
                    value: t,
                    label: t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
                  }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Jumlah (Rp) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="1"
                  value={projectForm.amount}
                  onChange={(e) => setProjectForm((p) => ({ ...p, amount: e.target.value }))}
                  placeholder="Contoh: 15000000"
                  className={inputCls("blue")}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Metode Pembayaran</label>
                <CustomSelect
                  value={projectForm.payment_method}
                  onChange={(val) => setProjectForm((p) => ({ ...p, payment_method: val as string }))}
                  options={[
                    { value: "transfer", label: "Transfer" },
                    { value: "cash", label: "Cash" },
                  ]}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Deskripsi <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={projectForm.description}
                  onChange={(e) => setProjectForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Deskripsi pembayaran"
                  className={inputCls("blue")}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Catatan <span className="text-xs text-gray-400">(opsional)</span>
                </label>
                <textarea
                  rows={3}
                  value={projectForm.notes}
                  onChange={(e) => setProjectForm((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Catatan tambahan"
                  className={`${inputCls("blue")} resize-none`}
                />
              </div>
            </>
          )}

          {modalTab === "material_sale" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tanggal <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={materialForm.income_date}
                  onChange={(e) => setMaterialForm((p) => ({ ...p, income_date: e.target.value }))}
                  className={inputCls("emerald")}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nama Customer <span className="text-red-500">*</span>
                </label>
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
                        setMaterialForm((p) => ({ ...p, customer_name: "" }));
                      }}
                      className="w-4 h-4 text-emerald-600"
                    />
                    Pelanggan Baru
                  </label>
                </div>
                {!isNewCustomer ? (
                  <CustomCombobox
                    required
                    value={materialForm.customer_name}
                    onChange={(val) => setMaterialForm((p) => ({ ...p, customer_name: val }))}
                    placeholder="Pilih Pelanggan..."
                    options={customers
                      .slice()
                      .sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""))
                      .map((c: any) => ({
                        value: c.name,
                        label: c.name,
                      }))}
                  />
                ) : (
                  <input
                    type="text"
                    required
                    value={materialForm.customer_name}
                    onChange={(e) => setMaterialForm((p) => ({ ...p, customer_name: e.target.value }))}
                    placeholder="Ketik nama pelanggan baru..."
                    className={inputCls("emerald")}
                  />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Jenis Material <span className="text-red-500">*</span>
                </label>
                <CustomSelect
                  required
                  value={materialForm.material_type}
                  onChange={(val) =>
                    setMaterialForm((p) => ({
                      ...p,
                      material_type: val as string,
                      unit: p.unit || "ritase",
                      quantity: "1",
                      unit_price: "",
                    }))
                  }
                  options={MATERIAL_TYPES.map((m) => ({ value: m, label: m }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Satuan <span className="text-red-500">*</span>
                </label>
                <CustomSelect
                  required
                  value={materialForm.unit}
                  onChange={(val) =>
                    setMaterialForm((p) => ({
                      ...p,
                      unit: val as string,
                      quantity: val === "ritase" ? "1" : p.quantity,
                      unit_price: "",
                    }))
                  }
                  options={[
                    { value: "ritase", label: "Ritase" },
                    { value: "m3", label: "Kubikasi (m³)" },
                    { value: "ton", label: "Tonase (ton)" },
                  ]}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Volume/Qty <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={materialForm.quantity}
                    onChange={(e) => setMaterialForm((p) => ({ ...p, quantity: e.target.value }))}
                    className={inputCls("emerald")}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Harga Satuan <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={materialForm.unit_price}
                    onChange={(e) => setMaterialForm((p) => ({ ...p, unit_price: e.target.value }))}
                    placeholder="Contoh: 85000"
                    className={inputCls("emerald")}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total (Rp) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  readOnly
                  value={materialForm.amount}
                  className={`${inputCls("emerald")} bg-gray-50 font-semibold text-emerald-700`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Metode Pembayaran</label>
                <CustomSelect
                  value={materialForm.payment_method}
                  onChange={(val) => setMaterialForm((p) => ({ ...p, payment_method: val as string }))}
                  options={[
                    { value: "transfer", label: "Transfer" },
                    { value: "cash", label: "Cash" },
                  ]}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Deskripsi <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={materialForm.description}
                  onChange={(e) => setMaterialForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Penjualan material ke customer..."
                  className={inputCls("emerald")}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project <span className="text-xs text-gray-400 font-normal">(opsional)</span>
                </label>
                <CustomSelect
                  value={materialForm.project_id}
                  onChange={(val) => setMaterialForm((p) => ({ ...p, project_id: val as string }))}
                  options={[
                    { value: "", label: "-- Tanpa Project (General) --" },
                    ...projects.map((p: any) => ({ value: String(p.id), label: p.name })),
                  ]}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Catatan <span className="text-xs text-gray-400">(opsional)</span>
                </label>
                <textarea
                  rows={2}
                  value={materialForm.notes}
                  onChange={(e) => setMaterialForm((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Catatan tambahan"
                  className={`${inputCls("emerald")} resize-none`}
                />
              </div>
            </>
          )}

          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-300 rounded-xl text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60 bg-emerald-600 hover:bg-emerald-700 shadow-sm"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editId ? "Simpan Perubahan" : "Tambah"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default IncomeFormModal;
