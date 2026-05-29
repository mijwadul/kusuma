import React, { useState, useEffect } from "react";
import { Search, Loader2, Save, ChevronDown, ChevronRight, Truck } from "lucide-react";
import { toast } from "sonner";
import { API_URL } from "../api/auth";

const formatIDR = (val) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(val || 0);

// Shared fetch with auth helper (could be imported if centralized, but keeping simple here)
const authFetchHelper = async (url, options = {}) => {
  const token = localStorage.getItem("token");
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      throw new Error(j.detail || text);
    } catch (e) {
      if (e.message !== "Unexpected token" && !e.message.includes("JSON")) throw e;
      throw new Error(text || `HTTP ${res.status}`);
    }
  }
  if (res.status === 204) return null;
  return res.json();
};

export default function SuratJalanPage() {
  const [filters, setFilters] = useState({
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [records, setRecords] = useState([]);
  const [items, setItems] = useState({});
  const [customers, setCustomers] = useState([]);

  // Hierarchical state
  const [expandedCustomers, setExpandedCustomers] = useState({});
  const [expandedNopols, setExpandedNopols] = useState({});

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const data = await authFetchHelper(`${API_URL}/projects-data/customers`);
        setCustomers(Array.isArray(data) ? data : []);
      } catch {
        // silently ignore
      }
    };
    fetchCustomers();
  }, []);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const res = await authFetchHelper(
        `${API_URL}/income-records?start_date=${filters.startDate}&end_date=${filters.endDate}&income_type=material_sale`
      );
      
      const allRecords = Array.isArray(res) ? res : res?.records || [];
      setRecords(allRecords);
      
      // Initialize items state
      const initialItems = {};
      
      allRecords.forEach((r) => {
        const cust = customers.find((c) => c.name === r.customer_name);
        
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
          sj_length: r.sj_length ?? defaultP,
          sj_width: r.sj_width ?? defaultL,
          sj_height: r.sj_height ?? defaultT,
          sj_volume_minus: r.sj_volume_minus ?? "",
          sj_gross_weight: r.sj_gross_weight ?? "",
          sj_tare_weight: r.sj_tare_weight ?? "",
          sj_weight_minus: r.sj_weight_minus ?? "",
        };
      });
      setItems(initialItems);

      // Auto-expand if only one customer
      const uniqueCustomers = [...new Set(allRecords.map(r => r.customer_name || "Unknown"))];
      if (uniqueCustomers.length === 1) {
          setExpandedCustomers({ [uniqueCustomers[0]]: true });
      } else {
          setExpandedCustomers({});
      }
      setExpandedNopols({});

      if (allRecords.length === 0) {
        toast.info("Tidak ada data ditemukan untuk periode ini.");
      }
    } catch (err) {
      toast.error("Gagal memuat data transaksi.");
    } finally {
      setLoading(false);
    }
  };

  // Load data on initial render
  useEffect(() => {
    if (customers.length > 0) {
        handleSearch();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers]);

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
      const safeParse = (val) => {
          if (val === "" || val === null || val === undefined) return null;
          const parsed = parseFloat(val);
          return isNaN(parsed) ? null : parsed;
      };

      const payloadItems = records.map(r => {
        const d = items[r.id] || {};
        return {
          id: r.id,
          unit: d.unit,
          sj_length: d.unit === "m3" ? safeParse(d.sj_length) : null,
          sj_width: d.unit === "m3" ? safeParse(d.sj_width) : null,
          sj_height: d.unit === "m3" ? safeParse(d.sj_height) : null,
          sj_volume_minus: d.unit === "m3" ? safeParse(d.sj_volume_minus) : null,
          sj_gross_weight: d.unit === "ton" ? safeParse(d.sj_gross_weight) : null,
          sj_tare_weight: d.unit === "ton" ? safeParse(d.sj_tare_weight) : null,
          sj_weight_minus: d.unit === "ton" ? safeParse(d.sj_weight_minus) : null,
        }
      });
      
      const truckUpdatesMap = {};
      records.forEach(r => {
         const d = items[r.id] || {};
         if (d.unit === "m3" && r.license_plate) {
            truckUpdatesMap[r.license_plate] = {
               license_plate: r.license_plate,
               length: safeParse(d.sj_length),
               width: safeParse(d.sj_width),
               height: safeParse(d.sj_height),
            };
         }
      });

      const payloadSJ = {
        unit: "mixed",
        items: payloadItems,
        truck_updates: Object.values(truckUpdatesMap)
      };

      const res = await authFetchHelper(`${API_URL}/income-records/bulk-sj`, {
        method: "PUT",
        body: JSON.stringify(payloadSJ)
      });
      
      toast.success(res.message || "Berhasil menyimpan update Surat Jalan massal.");
    } catch (err) {
      toast.error("Gagal menyimpan data: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleCustomer = (c) => setExpandedCustomers(p => ({...p, [c]: !p[c]}));
  const toggleNopol = (c, n) => setExpandedNopols(p => ({...p, [`${c}-${n}`]: !p[`${c}-${n}`]}));

  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300";

  // Grouping
  const grouped = {};
  records.forEach(r => {
     const cust = r.customer_name || "Unknown";
     const nopol = r.license_plate || "Tanpa Nopol";
     if (!grouped[cust]) grouped[cust] = {};
     if (!grouped[cust][nopol]) grouped[cust][nopol] = [];
     grouped[cust][nopol].push(r);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
            Manajemen Surat Jalan
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Kelola detail dan kalkulasi surat jalan untuk penjualan material
          </p>
        </div>
        <div>
          <button 
            type="button" 
            onClick={handleSave} 
            disabled={saving || records.length === 0}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50 shadow-sm"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Simpan Perubahan
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 w-full">
          <label className="block text-xs font-medium text-gray-600 mb-1">Dari Tanggal</label>
          <input type="date" value={filters.startDate} onChange={e => setFilters(p => ({...p, startDate: e.target.value}))} className={inputCls} />
        </div>
        <div className="flex-1 w-full">
          <label className="block text-xs font-medium text-gray-600 mb-1">Sampai Tanggal</label>
          <input type="date" value={filters.endDate} onChange={e => setFilters(p => ({...p, endDate: e.target.value}))} className={inputCls} />
        </div>
        <button 
          onClick={handleSearch} 
          disabled={loading}
          className="w-full md:w-auto px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg transition-colors flex items-center justify-center gap-2 font-medium text-sm"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Cari Data
        </button>
      </div>

      {/* Table Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="ml-2">Memuat data...</span>
            </div>
        ) : Object.keys(grouped).length === 0 ? (
            <div className="py-16 text-center text-gray-400">
                <Truck className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Belum ada surat jalan pada periode ini.</p>
            </div>
        ) : (
            <div className="divide-y divide-gray-100">
                {Object.keys(grouped).sort().map(cust => (
                    <div key={cust} className="flex flex-col">
                        {/* Customer Header */}
                        <div 
                            className="bg-slate-50 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors"
                            onClick={() => toggleCustomer(cust)}
                        >
                            <div className="flex items-center gap-2">
                                {expandedCustomers[cust] ? <ChevronDown className="w-5 h-5 text-gray-500" /> : <ChevronRight className="w-5 h-5 text-gray-500" />}
                                <span className="font-bold text-gray-800 text-sm">{cust}</span>
                                <span className="bg-white border border-gray-200 px-2 py-0.5 rounded-full text-xs font-medium text-gray-500">
                                    {Object.values(grouped[cust]).flat().length} records
                                </span>
                            </div>
                        </div>

                        {/* Nopol List */}
                        {expandedCustomers[cust] && (
                            <div className="divide-y divide-gray-50 border-t border-gray-100">
                                {Object.keys(grouped[cust]).sort().map(nopol => (
                                    <div key={nopol} className="flex flex-col">
                                        <div 
                                            className="px-8 py-2.5 bg-white flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                                            onClick={() => toggleNopol(cust, nopol)}
                                        >
                                            <div className="flex items-center gap-2">
                                                {expandedNopols[`${cust}-${nopol}`] ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                                                <div className="flex items-center gap-2">
                                                    <Truck className="w-4 h-4 text-amber-500" />
                                                    <span className="font-semibold text-gray-700 text-sm">{nopol}</span>
                                                </div>
                                            </div>
                                            <span className="text-xs text-gray-400 font-medium">
                                                {grouped[cust][nopol].length} surat jalan
                                            </span>
                                        </div>

                                        {/* Records Table for this Nopol */}
                                        {expandedNopols[`${cust}-${nopol}`] && (
                                            <div className="px-8 pb-4 pt-1 bg-gray-50/30 overflow-x-auto">
                                                <table className="w-full text-xs">
                                                  <thead className="bg-gray-100/50 border-y border-gray-200 whitespace-nowrap">
                                                    <tr>
                                                      <th className="px-3 py-2 text-left font-semibold text-gray-600">Tanggal</th>
                                                      <th className="px-3 py-2 text-left font-semibold text-gray-600">Material & Unit</th>
                                                      <th className="px-3 py-2 text-center font-semibold text-gray-600" colSpan={4}>Ukuran / Timbangan</th>
                                                      <th className="px-3 py-2 text-right font-semibold text-gray-600 w-24">Netto</th>
                                                    </tr>
                                                  </thead>
                                                  <tbody className="divide-y divide-gray-100">
                                                    {grouped[cust][nopol].map(r => {
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
                                                        <tr key={r.id} className="hover:bg-white bg-transparent transition-colors">
                                                          <td className="px-3 py-2 whitespace-nowrap">
                                                            <div className="font-medium text-gray-800">{new Date(r.income_date).toLocaleDateString("id-ID")}</div>
                                                          </td>
                                                          <td className="px-3 py-2">
                                                            <div className="font-medium text-gray-800 mb-1 truncate max-w-[150px]" title={r.material_type}>{r.material_type}</div>
                                                            {showUnitDropdown ? (
                                                                <select 
                                                                    value={itemData.unit} 
                                                                    onChange={e => handleItemChange(r.id, "unit", e.target.value)}
                                                                    className="w-full border border-gray-200 rounded p-1 text-xs focus:ring-1 focus:ring-amber-300"
                                                                >
                                                                    {validUnits.map(u => <option key={u} value={u}>{u === "m3" ? "Kubikasi (m3)" : "Tonase (ton)"}</option>)}
                                                                </select>
                                                            ) : (
                                                                <div className="text-gray-500 bg-gray-200 px-2 py-0.5 rounded text-[10px] uppercase font-bold w-fit">
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
                                                                  className="w-20 text-right border border-gray-200 rounded px-1.5 py-1.5 focus:ring-1 focus:ring-amber-300 bg-white"
                                                                />
                                                              </td>
                                                              <td className="px-2 py-2">
                                                                <label className="block text-[10px] text-gray-400 mb-0.5">Lebar (L)</label>
                                                                <input 
                                                                  type="number" step="any" value={itemData.sj_width} onChange={e => handleItemChange(r.id, "sj_width", e.target.value)} 
                                                                  className="w-20 text-right border border-gray-200 rounded px-1.5 py-1.5 focus:ring-1 focus:ring-amber-300 bg-white"
                                                                />
                                                              </td>
                                                              <td className="px-2 py-2">
                                                                <label className="block text-[10px] text-gray-400 mb-0.5">Tinggi (T)</label>
                                                                <input 
                                                                  type="number" step="any" value={itemData.sj_height} onChange={e => handleItemChange(r.id, "sj_height", e.target.value)} 
                                                                  className="w-20 text-right border border-gray-200 rounded px-1.5 py-1.5 focus:ring-1 focus:ring-amber-300 bg-white"
                                                                />
                                                              </td>
                                                              <td className="px-2 py-2">
                                                                <label className="block text-[10px] text-red-400 mb-0.5 font-medium">Minus T</label>
                                                                <input 
                                                                  type="number" step="any" value={itemData.sj_volume_minus} onChange={e => handleItemChange(r.id, "sj_volume_minus", e.target.value)} 
                                                                  className="w-20 text-right border border-red-200 rounded px-1.5 py-1.5 focus:ring-1 focus:ring-red-300 text-red-600 bg-red-50/50"
                                                                />
                                                              </td>
                                                            </>
                                                          ) : (
                                                            <>
                                                              <td className="px-2 py-2">
                                                                <label className="block text-[10px] text-gray-400 mb-0.5">Bruto (B1)</label>
                                                                <input 
                                                                  type="number" step="any" value={itemData.sj_gross_weight} onChange={e => handleItemChange(r.id, "sj_gross_weight", e.target.value)} 
                                                                  className="w-20 text-right border border-gray-200 rounded px-1.5 py-1.5 focus:ring-1 focus:ring-amber-300 bg-white"
                                                                />
                                                              </td>
                                                              <td className="px-2 py-2">
                                                                <label className="block text-[10px] text-gray-400 mb-0.5">Tara (B2)</label>
                                                                <input 
                                                                  type="number" step="any" value={itemData.sj_tare_weight} onChange={e => handleItemChange(r.id, "sj_tare_weight", e.target.value)} 
                                                                  className="w-20 text-right border border-gray-200 rounded px-1.5 py-1.5 focus:ring-1 focus:ring-amber-300 bg-white"
                                                                />
                                                              </td>
                                                              <td className="px-2 py-2">
                                                                <label className="block text-[10px] text-red-400 mb-0.5 font-medium">Minus Berat</label>
                                                                <input 
                                                                  type="number" step="any" value={itemData.sj_weight_minus} onChange={e => handleItemChange(r.id, "sj_weight_minus", e.target.value)} 
                                                                  className="w-20 text-right border border-red-200 rounded px-1.5 py-1.5 focus:ring-1 focus:ring-red-300 text-red-600 bg-red-50/50"
                                                                />
                                                              </td>
                                                              <td className="px-2 py-2"></td>
                                                            </>
                                                          )}
                                                          
                                                          <td className="px-3 py-2 text-right font-bold text-emerald-600 align-bottom pb-3 whitespace-nowrap">
                                                            {netto.toFixed(2)} {itemData.unit === "m3" ? "m³" : "ton"}
                                                          </td>
                                                        </tr>
                                                      );
                                                    })}
                                                  </tbody>
                                                </table>
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
    </div>
  );
}
