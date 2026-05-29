// File deprecated. Component moved to SuratJalanPage.jsx
import { X, Search, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

// Helper formatter
const formatIDR = (val) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(val || 0);

export default function SuratJalanManagerModal({
  onClose,
  API_URL,
  authFetchHelper,
  customers,
  onSaved
}) {
  const [filters, setFilters] = useState({
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
    customer_name: "",
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [records, setRecords] = useState([]);
  const [items, setItems] = useState({});

  const handleSearch = async () => {
    if (!filters.customer_name) {
      toast.error("Pilih Customer terlebih dahulu!");
      return;
    }

    setLoading(true);
    try {
      const res = await authFetchHelper(
        `${API_URL}/income-records?start_date=${filters.startDate}&end_date=${filters.endDate}&income_type=material_sale`
      );
      
      const allRecords = Array.isArray(res) ? res : res?.records || [];
      // Filter by customer only
      const filtered = allRecords.filter(
        (r) => r.customer_name === filters.customer_name
      );
      
      setRecords(filtered);
      
      // Initialize items state
      const initialItems = {};
      const cust = customers.find((c) => c.name === filters.customer_name);
      
      filtered.forEach((r) => {
        // Find preferred units for this material
        const prefs = cust?.material_preferences?.filter(m => m.material_type === r.material_type) || [];
        const validPrefUnits = prefs.map(p => p.unit).filter(u => u === "m3" || u === "ton");
        
        let defaultUnit = r.unit;
        // If current unit is invalid for calculation (e.g., ritase) or not set
        if (!defaultUnit || (defaultUnit !== "m3" && defaultUnit !== "ton")) {
            if (validPrefUnits.length > 0) {
                defaultUnit = validPrefUnits[0];
            } else {
                defaultUnit = "ton"; // fallback
            }
        }
        
        // Load default P,L,T from truck master if available
        let defaultP = "", defaultL = "", defaultT = "";
        if (r.license_plate) {
            const truck = cust?.trucks?.find(t => t.license_plate === r.license_plate);
            if (truck) {
               defaultP = truck.length || "";
               defaultL = truck.width || "";
               defaultT = truck.height || "";
            }
        }

        initialItems[r.id] = {
          unit: defaultUnit,
          _validUnits: validPrefUnits,
          sj_length: r.sj_length || defaultP,
          sj_width: r.sj_width || defaultL,
          sj_height: r.sj_height || defaultT,
          sj_volume_minus: r.sj_volume_minus || "",
          sj_gross_weight: r.sj_gross_weight || "",
          sj_tare_weight: r.sj_tare_weight || "",
          sj_weight_minus: r.sj_weight_minus || "",
        };
      });
      setItems(initialItems);

      if (filtered.length === 0) {
        toast.error("Tidak ada data ditemukan untuk filter ini.");
      }
    } catch (err) {
      toast.error("Gagal memuat data transaksi.");
    } finally {
      setLoading(false);
    }
  };

  const handleItemChange = (id, field, value) => {
    setItems((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value
      }
    }));
  };

  const handleSave = async () => {
    if (records.length === 0) return;
    setSaving(true);
    try {
      const payloadItems = records.map(r => {
        const d = items[r.id];
        return {
          id: r.id,
          unit: d.unit,
          sj_length: d.unit === "m3" && d.sj_length ? parseFloat(d.sj_length) : null,
          sj_width: d.unit === "m3" && d.sj_width ? parseFloat(d.sj_width) : null,
          sj_height: d.unit === "m3" && d.sj_height ? parseFloat(d.sj_height) : null,
          sj_volume_minus: d.unit === "m3" && d.sj_volume_minus ? parseFloat(d.sj_volume_minus) : null,
          sj_gross_weight: d.unit === "ton" && d.sj_gross_weight ? parseFloat(d.sj_gross_weight) : null,
          sj_tare_weight: d.unit === "ton" && d.sj_tare_weight ? parseFloat(d.sj_tare_weight) : null,
          sj_weight_minus: d.unit === "ton" && d.sj_weight_minus ? parseFloat(d.sj_weight_minus) : null,
        }
      });
      
      const truckUpdatesMap = {};
      records.forEach(r => {
         const d = items[r.id];
         if (d.unit === "m3" && r.license_plate) {
            truckUpdatesMap[r.license_plate] = {
               license_plate: r.license_plate,
               length: d.sj_length ? parseFloat(d.sj_length) : null,
               width: d.sj_width ? parseFloat(d.sj_width) : null,
               height: d.sj_height ? parseFloat(d.sj_height) : null,
            };
         }
      });

      const payloadSJ = {
        unit: "mixed", // just for compatibility with older schema if needed, we rely on item.unit now
        items: payloadItems,
        truck_updates: Object.values(truckUpdatesMap)
      };

      const res = await authFetchHelper(`${API_URL}/income-records/bulk-sj`, {
        method: "PUT",
        body: JSON.stringify(payloadSJ)
      });
      
      toast.success(res.message || "Berhasil menyimpan update Surat Jalan massal.");
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      toast.error("Gagal menyimpan data: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300";

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-[95vw] h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white rounded-t-2xl shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Manajemen Surat Jalan</h2>
            <p className="text-sm text-gray-500">Edit ukuran PxLxT atau Berat secara massal untuk seluruh armada</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-gray-50/50">
          
          {/* Filter Panel */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Dari Tanggal</label>
              <input type="date" value={filters.startDate} onChange={e => setFilters(p => ({...p, startDate: e.target.value}))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Sampai Tanggal</label>
              <input type="date" value={filters.endDate} onChange={e => setFilters(p => ({...p, endDate: e.target.value}))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Customer</label>
              <select value={filters.customer_name} onChange={e => setFilters(p => ({...p, customer_name: e.target.value}))} className={inputCls}>
                <option value="">-- Pilih Customer --</option>
                {customers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <button 
                onClick={handleSearch} 
                disabled={loading}
                className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2 font-medium text-sm"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Cari Data
              </button>
            </div>
          </div>

          {/* Table Data */}
          {records.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex-1 overflow-hidden flex flex-col">
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b whitespace-nowrap sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2 text-left">Tgl & Nopol</th>
                      <th className="px-3 py-2 text-left w-32">Material & Kalkulasi</th>
                      <th className="px-3 py-2 text-center" colSpan={4}>Ukuran / Timbangan</th>
                      <th className="px-3 py-2 text-right w-24">Netto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {records.map(r => {
                      const itemData = items[r.id] || {};
                      const validUnits = itemData._validUnits || [];
                      const showUnitDropdown = validUnits.length > 1;
                      
                      let netto = 0;
                      if (itemData.unit === "m3") {
                        const p = parseFloat(itemData.sj_length) || 0;
                        const l = parseFloat(itemData.sj_width) || 0;
                        const t = parseFloat(itemData.sj_height) || 0;
                        const m = parseFloat(itemData.sj_volume_minus) || 0;
                        const rawNetto = (p * l * Math.max(0, t - m)) / 1000000;
                        netto = Math.floor(rawNetto * 100) / 100;
                      } else if (itemData.unit === "ton") {
                        const b1 = parseFloat(itemData.sj_gross_weight) || 0;
                        const b2 = parseFloat(itemData.sj_tare_weight) || 0;
                        const m = parseFloat(itemData.sj_weight_minus) || 0;
                        netto = Math.max(0, b1 - b2 - m);
                      }

                      return (
                        <tr key={r.id} className="hover:bg-gray-50/50">
                          <td className="px-3 py-2 whitespace-nowrap">
                            <div className="font-medium text-gray-800">{r.license_plate || "-"}</div>
                            <div className="text-gray-500">{new Date(r.income_date).toLocaleDateString("id-ID")}</div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="font-medium text-gray-800 mb-1 truncate max-w-[120px]" title={r.material_type}>{r.material_type}</div>
                            {showUnitDropdown ? (
                                <select 
                                    value={itemData.unit} 
                                    onChange={e => handleItemChange(r.id, "unit", e.target.value)}
                                    className="w-full border border-gray-200 rounded p-1 text-xs"
                                >
                                    {validUnits.map(u => <option key={u} value={u}>{u === "m3" ? "Kubikasi (m3)" : "Tonase (ton)"}</option>)}
                                </select>
                            ) : (
                                <div className="text-gray-500 bg-gray-100 px-2 py-0.5 rounded text-[10px] uppercase font-bold w-fit">
                                    {itemData.unit === "m3" ? "M3" : "TON"}
                                </div>
                            )}
                          </td>
                          
                          {itemData.unit === "m3" ? (
                            <>
                              <td className="px-2 py-2">
                                <label className="block text-[10px] text-gray-400 mb-0.5">Panjang (P)</label>
                                <input 
                                  type="number" step="any" value={itemData.sj_length} onChange={e => handleItemChange(r.id, "sj_length", e.target.value)} 
                                  className="w-20 text-right border border-gray-200 rounded px-1.5 py-1 focus:ring-1 focus:ring-amber-300"
                                />
                              </td>
                              <td className="px-2 py-2">
                                <label className="block text-[10px] text-gray-400 mb-0.5">Lebar (L)</label>
                                <input 
                                  type="number" step="any" value={itemData.sj_width} onChange={e => handleItemChange(r.id, "sj_width", e.target.value)} 
                                  className="w-20 text-right border border-gray-200 rounded px-1.5 py-1 focus:ring-1 focus:ring-amber-300"
                                />
                              </td>
                              <td className="px-2 py-2">
                                <label className="block text-[10px] text-gray-400 mb-0.5">Tinggi (T)</label>
                                <input 
                                  type="number" step="any" value={itemData.sj_height} onChange={e => handleItemChange(r.id, "sj_height", e.target.value)} 
                                  className="w-20 text-right border border-gray-200 rounded px-1.5 py-1 focus:ring-1 focus:ring-amber-300"
                                />
                              </td>
                              <td className="px-2 py-2">
                                <label className="block text-[10px] text-red-400 mb-0.5">Minus T</label>
                                <input 
                                  type="number" step="any" value={itemData.sj_volume_minus} onChange={e => handleItemChange(r.id, "sj_volume_minus", e.target.value)} 
                                  className="w-20 text-right border border-red-200 rounded px-1.5 py-1 focus:ring-1 focus:ring-red-300 text-red-600 bg-red-50"
                                />
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-2 py-2">
                                <label className="block text-[10px] text-gray-400 mb-0.5">Bruto (B1)</label>
                                <input 
                                  type="number" step="any" value={itemData.sj_gross_weight} onChange={e => handleItemChange(r.id, "sj_gross_weight", e.target.value)} 
                                  className="w-20 text-right border border-gray-200 rounded px-1.5 py-1 focus:ring-1 focus:ring-amber-300"
                                />
                              </td>
                              <td className="px-2 py-2">
                                <label className="block text-[10px] text-gray-400 mb-0.5">Tara (B2)</label>
                                <input 
                                  type="number" step="any" value={itemData.sj_tare_weight} onChange={e => handleItemChange(r.id, "sj_tare_weight", e.target.value)} 
                                  className="w-20 text-right border border-gray-200 rounded px-1.5 py-1 focus:ring-1 focus:ring-amber-300"
                                />
                              </td>
                              <td className="px-2 py-2">
                                <label className="block text-[10px] text-red-400 mb-0.5">Minus Berat</label>
                                <input 
                                  type="number" step="any" value={itemData.sj_weight_minus} onChange={e => handleItemChange(r.id, "sj_weight_minus", e.target.value)} 
                                  className="w-20 text-right border border-red-200 rounded px-1.5 py-1 focus:ring-1 focus:ring-red-300 text-red-600 bg-red-50"
                                />
                              </td>
                              <td className="px-2 py-2">
                                {/* Empty cell to match colspan of m3 */}
                              </td>
                            </>
                          )}
                          
                          <td className="px-3 py-2 text-right font-bold text-emerald-600 align-bottom pb-3">
                            {netto.toFixed(2)} {itemData.unit === "m3" ? "m³" : "ton"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-white rounded-b-2xl flex justify-end gap-3 shrink-0">
          <button 
            type="button" 
            onClick={onClose} 
            className="px-5 py-2.5 rounded-xl border font-medium hover:bg-gray-50 transition-colors text-sm"
          >
            Tutup
          </button>
          <button 
            type="button" 
            onClick={handleSave} 
            disabled={saving || records.length === 0}
            className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition-colors flex items-center gap-2 text-sm disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Simpan Perubahan
          </button>
        </div>
      </div>
    </div>
  );
}
