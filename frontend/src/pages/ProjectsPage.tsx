import React, { useState } from "react";
import { toast } from "sonner";
import {
  Briefcase,
  Users,
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  Truck,
  FileText,
} from "lucide-react";

import apiClient from '../api/apiClient';
import { usePermissions } from '../hooks/usePermissions';
import {
  useProjectsList,
  useCustomersList,
  useProjectMeta,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  useCreateCustomer,
  useUpdateCustomer,
  useDeleteCustomer,
  Project,
  Customer,
} from "../hooks/useProjects";

import ProjectFormModal from "../components/projects/ProjectFormModal";
import CustomerFormModal from "../components/projects/CustomerFormModal";
import HaulingPricesModal from "../components/HaulingPricesModal";
import ProjectInvoiceTab from "../components/projects/ProjectInvoiceTab";

const formatIDR = (v?: number | string | null) =>
  Number(v ?? 0).toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  });

export default function ProjectsPage() {
  const [activeTab, setActiveTab] = useState<"projects" | "customers" | "invoice">("projects");
  const { isGM: isGMPermission } = usePermissions();

  // Queries
  const { data: meta } = useProjectMeta();
  const { data: projects = [], isLoading: loadingProjects } = useProjectsList(undefined, { enabled: activeTab === "projects" });
  const { data: customers = [], isLoading: loadingCustomers } = useCustomersList(undefined, { enabled: activeTab === "customers" });

  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [allEmployees, setAllEmployees] = useState<any[]>([]);

  React.useEffect(() => {
    if (activeTab === "projects") {
      apiClient.get('/auth/users').then(r => setAllUsers(r.data)).catch(() => {});
      apiClient.get('/employees/employees?limit=1000').then(r => setAllEmployees(r.data)).catch(() => {});
    }
  }, [activeTab]);

  // Mutations
  const createProjectMutation = useCreateProject();
  const updateProjectMutation = useUpdateProject();
  const deleteProjectMutation = useDeleteProject();
  const createCustomerMutation = useCreateCustomer();
  const updateCustomerMutation = useUpdateCustomer();
  const deleteCustomerMutation = useDeleteCustomer();

  // Modals state
  const [showProjModal, setShowProjModal] = useState(false);
  const [showCustModal, setShowCustModal] = useState(false);
  const [showHaulingModal, setShowHaulingModal] = useState<Project | null>(null);
  const [editDataProj, setEditDataProj] = useState<Project | null>(null);
  const [editDataCust, setEditDataCust] = useState<Customer | null>(null);
  const [viewCust, setViewCust] = useState<Customer | null>(null);
  const [viewProj, setViewProj] = useState<Project | null>(null);
  
  // Confirm Delete state
  const [confirmDeleteProj, setConfirmDeleteProj] = useState<Project | null>(null);
  const [confirmDeleteCust, setConfirmDeleteCust] = useState<Customer | null>(null);

  // Form states
  const [projForm, setProjForm] = useState<Partial<Project>>({
    name: "", client_name: "", description: "", location: "",
    start_date: "", end_date: "", budget: 0, status: "ongoing", notes: "",
    material_items: [], measurement_type: "tonase", assigned_user_ids: [], assigned_employee_ids: []
  });
  
  const [custForm, setCustForm] = useState<Partial<Customer>>({
    name: "", company: "", contact_person: "", phone: "", email: "", address: "",
    notes: "", is_active: true, material_preferences: [], trucks: []
  });

  const isGM = isGMPermission;

  const isLoading = activeTab === "projects" ? loadingProjects : activeTab === "customers" ? loadingCustomers : false;

  const handleDelete = async () => {
    try {
      if (activeTab === "projects" && confirmDeleteProj) {
        await deleteProjectMutation.mutateAsync(confirmDeleteProj.id);
        toast.success("Proyek berhasil dihapus");
      } else if (activeTab === "customers" && confirmDeleteCust) {
        await deleteCustomerMutation.mutateAsync(confirmDeleteCust.id);
        toast.success("Pelanggan berhasil dihapus");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || err.message || "Gagal menghapus");
    } finally {
      setConfirmDeleteProj(null);
      setConfirmDeleteCust(null);
    }
  };

  // --- Project Form Helpers ---
  const openProjModal = (p: Project | null = null) => {
    setEditDataProj(p);
    if (p) {
      setProjForm({
        ...p,
        name: p.name || "",
        client_name: p.client_name || "",
        description: p.description || "",
        location: p.location || "",
        start_date: p.start_date || "",
        end_date: p.end_date || "",
        budget: p.budget || 0,
        notes: p.notes || "",
        material_items: p.material_items.map(m => {
          const validUnits = meta?.material_units?.[m.material_type] || meta?.all_units || [];
          const unit = validUnits.includes(m.unit) ? m.unit : validUnits[0] || "ton";
          return { ...m, unit };
        }),
        measurement_type: p.measurement_type || "tonase",
        assigned_user_ids: p.assigned_users?.map(u => u.id) || p.assigned_user_ids || [],
        assigned_employee_ids: p.assigned_employees?.map(e => e.id) || p.assigned_employee_ids || [],
      });
    } else {
      setProjForm({
        name: "", client_name: "", description: "", location: "",
        start_date: "", end_date: "", budget: 0, status: "ongoing", notes: "",
        material_items: []
      });
    }
    setShowProjModal(true);
  };

  const saveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...projForm,
        budget: parseFloat(String(projForm.budget)) || 0,
        material_items: (projForm.material_items || []).map(m => ({
          ...m,
          target_quantity: parseFloat(String(m.target_quantity)) || 0,
          unit_price: m.unit_price ? parseFloat(String(m.unit_price)) : null
        }))
      };
      
      if (editDataProj) {
        await updateProjectMutation.mutateAsync({ id: editDataProj.id, data: payload });
      } else {
        await createProjectMutation.mutateAsync(payload);
      }
      toast.success("Proyek berhasil disimpan");
      setShowProjModal(false);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || err.message || "Gagal menyimpan proyek");
    }
  };

  const addProjMaterial = () => {
    setProjForm(prev => {
      const defaultMat = meta?.material_types?.[0] || "";
      const defaultUnit = (meta?.material_units?.[defaultMat] || ["ton"])[0];
      const newItems = prev.material_items ? [...prev.material_items] : [];
      newItems.push({ material_type: defaultMat, unit: defaultUnit, target_quantity: "", unit_price: "" });
      return { ...prev, material_items: newItems };
    });
  };

  const updateProjMaterial = (idx: number, field: string, val: string | number) => {
    setProjForm(prev => {
      const arr = prev.material_items ? [...prev.material_items] : [];
      (arr[idx] as any)[field] = val;
      if (field === "material_type" && meta?.material_units) {
        arr[idx].unit = meta.material_units[String(val)]?.[0] || "ton";
      }
      return { ...prev, material_items: arr };
    });
  };

  const removeProjMaterial = (idx: number) => {
    setProjForm(prev => ({ 
      ...prev, 
      material_items: prev.material_items?.filter((_, i) => i !== idx) 
    }));
  };

  // --- Customer Form Helpers ---
  const openCustModal = (c: Customer | null = null) => {
    setEditDataCust(c);
    if (c) {
      setCustForm({
        ...c,
        name: c.name || "",
        company: c.company || "",
        contact_person: c.contact_person || "",
        phone: c.phone || "",
        email: c.email || "",
        address: c.address || "",
        notes: c.notes || "",
        material_preferences: c.material_preferences.map(m => {
          const validUnits = meta?.material_units?.[m.material_type] || meta?.all_units || [];
          const unit = validUnits.includes(m.unit) ? m.unit : validUnits[0] || "ton";
          return { ...m, unit };
        }),
        trucks: c.trucks ? c.trucks.map(t => ({ ...t })) : []
      });
    } else {
      setCustForm({
        name: "", company: "", contact_person: "", phone: "", email: "", address: "",
        notes: "", is_active: true, material_preferences: [], trucks: []
      });
    }
    setShowCustModal(true);
  };

  const saveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editDataCust) {
        await updateCustomerMutation.mutateAsync({ id: editDataCust.id, data: custForm });
      } else {
        await createCustomerMutation.mutateAsync(custForm);
      }
      toast.success("Pelanggan berhasil disimpan");
      setShowCustModal(false);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || err.message || "Gagal menyimpan pelanggan");
    }
  };

  const addCustMaterial = () => {
    setCustForm(prev => {
      const defaultMat = meta?.material_types?.[0] || "";
      const defaultUnit = (meta?.material_units?.[defaultMat] || ["ton"])[0];
      const newPrefs = prev.material_preferences ? [...prev.material_preferences] : [];
      newPrefs.push({ material_type: defaultMat, unit: defaultUnit, vehicle_type: "Tronton" });
      return { ...prev, material_preferences: newPrefs };
    });
  };

  const updateCustMaterial = (idx: number, field: string, val: string | number) => {
    setCustForm(prev => {
      const arr = prev.material_preferences ? [...prev.material_preferences] : [];
      (arr[idx] as any)[field] = val;
      if (field === "material_type" && meta?.material_units) {
        arr[idx].unit = meta.material_units[String(val)]?.[0] || "ton";
      }
      return { ...prev, material_preferences: arr };
    });
  };

  const addCustTruck = () => {
    setCustForm(prev => ({
      ...prev,
      trucks: [...(prev.trucks || []), { license_plate: "", driver_name: "", vehicle_type: "Colt Diesel" }]
    }));
  };

  const updateCustTruck = (idx: number, field: string, val: string) => {
    setCustForm(prev => {
      const arr = prev.trucks ? [...prev.trucks] : [];
      (arr[idx] as any)[field] = val;
      return { ...prev, trucks: arr };
    });
  };

  const removeCustMaterial = (idx: number) => {
    setCustForm(prev => ({ ...prev, material_preferences: prev.material_preferences?.filter((_, i) => i !== idx) }));
  };

  const removeCustTruck = (idx: number) => {
    setCustForm(prev => ({ ...prev, trucks: prev.trucks?.filter((_, i) => i !== idx) }));
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Manajemen Proyek & Pelanggan</h1>
          <p className="text-sm text-gray-500 mt-1">Kelola data proyek, target material, dan pelanggan tetap</p>
        </div>
        {isGM && (
          <button
            onClick={() => activeTab === "projects" ? openProjModal() : openCustModal()}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            <Plus size={16} /> Tambah {activeTab === "projects" ? "Proyek" : "Pelanggan"}
          </button>
        )}
      </div>

      <div className="flex gap-2 p-1 bg-gray-100 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab("projects")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "projects" ? "bg-white shadow text-emerald-700" : "text-gray-600 hover:text-gray-800"}`}
        >
          <Briefcase size={16} /> Project
        </button>
        <button
          onClick={() => setActiveTab("customers")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "customers" ? "bg-white shadow text-blue-700" : "text-gray-600 hover:text-gray-800"}`}
        >
          <Users size={16} /> Customer
        </button>
        <button
          onClick={() => setActiveTab("invoice")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "invoice" ? "bg-white shadow text-indigo-700" : "text-gray-600 hover:text-gray-800"}`}
        >
          <FileText size={16} /> Invoice Project
        </button>
      </div>

      <div className={activeTab === "invoice" ? "" : "bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[400px]"}>
        {isLoading ? (
          <div className="flex justify-center py-20 text-gray-400"><Loader2 className="animate-spin" size={24} /></div>
        ) : activeTab === "invoice" ? (
          <ProjectInvoiceTab />
        ) : activeTab === "projects" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b whitespace-nowrap">
                <tr>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Nama Proyek & Klien</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Lokasi</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Budget</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Target Material</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {projects.map(p => (
                  <tr key={p.id} onClick={() => setViewProj(p)} className="hover:bg-emerald-50/60 cursor-pointer transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="font-semibold text-gray-800">{p.name}</p>
                      <p className="text-xs text-gray-500">{p.client_name || "-"}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{p.location || "-"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-medium text-emerald-700">
                        {p.budget ? formatIDR(p.budget) : "-"}
                      </div>
                      {p.budget ? (
                        <div className="text-xs mt-1">
                          <span className="text-gray-500">Terpakai: </span>
                          <span className="text-rose-600 font-medium">{formatIDR(p.budget_used)}</span>
                          <br />
                          <span className="text-gray-500">Sisa: </span>
                          <span className="text-blue-600 font-medium">{formatIDR(p.remaining_budget)}</span>
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                      {p.material_items.length === 0 ? "-" : (
                        <ul className="list-disc pl-4">
                          {p.material_items.map((m, i) => (
                            <li key={i}>{m.target_quantity} {m.unit} {m.material_type}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${
                        p.status === 'completed' ? 'bg-green-100 text-green-700' :
                        p.status === 'paused' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {projects.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-10 text-gray-400">Belum ada proyek</td></tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b whitespace-nowrap">
                <tr>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Nama / Perusahaan</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Kontak</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Armada Kendaraan</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Preferensi Material</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Total Pembelian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {customers.map(c => (
                  <tr key={c.id} onClick={() => setViewCust(c)} className="hover:bg-emerald-50/60 cursor-pointer transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="font-semibold text-gray-800">{c.name}</p>
                      <p className="text-xs text-gray-500">{c.company || "-"}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                      <p>{c.phone || "-"}</p>
                      <p>{c.contact_person || "-"}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                      {!c.trucks || c.trucks.length === 0 ? "-" : (
                        <span className="text-gray-500 font-medium">{c.trucks.length} Kendaraan terdaftar</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                      {!c.material_preferences || c.material_preferences.length === 0 ? "-" : (
                        <div className="flex flex-col gap-1">
                          {c.material_preferences.map((m, i) => (
                            <span key={i} className="bg-gray-100 px-2 py-0.5 rounded w-fit">
                              {m.material_type} ({m.unit})
                              {m.vehicle_type ? ` - ${m.vehicle_type}` : ""}
                              {m.unit_price ? ` - ${formatIDR(m.unit_price)}` : ""}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-emerald-700 whitespace-nowrap">
                      {formatIDR(c.total_purchases)} <span className="text-gray-400 font-normal text-xs">({c.purchase_count || 0}x)</span>
                    </td>
                  </tr>
                ))}
                {customers.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-10 text-gray-400">Belum ada pelanggan</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Project Modal */}
      <ProjectFormModal
        show={showProjModal}
        onClose={() => setShowProjModal(false)}
        editDataProj={editDataProj}
        projForm={projForm}
        setProjForm={setProjForm}
        meta={meta}
        allUsers={allUsers}
        allEmployees={allEmployees}
        saveProject={saveProject}
        isPending={createProjectMutation.isPending || updateProjectMutation.isPending}
        addProjMaterial={addProjMaterial}
        updateProjMaterial={updateProjMaterial}
        removeProjMaterial={removeProjMaterial}
      />

      {/* Customer Modal */}
      <CustomerFormModal
        show={showCustModal}
        onClose={() => setShowCustModal(false)}
        editDataCust={editDataCust}
        custForm={custForm}
        setCustForm={setCustForm}
        meta={meta}
        saveCustomer={saveCustomer}
        isPending={createCustomerMutation.isPending || updateCustomerMutation.isPending}
        addCustMaterial={addCustMaterial}
        updateCustMaterial={updateCustMaterial}
        removeCustMaterial={removeCustMaterial}
        addCustTruck={addCustTruck}
        updateCustTruck={updateCustTruck}
        removeCustTruck={removeCustTruck}
      />

      {/* Customer Detail Modal */}
      {viewCust && !showCustModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setViewCust(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-2xl">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-emerald-600" />
                <h2 className="text-base font-semibold text-gray-800">Detail Pelanggan</h2>
              </div>
              <button onClick={() => setViewCust(null)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="px-6 py-5 overflow-y-auto">
              <div className="mb-6">
                <h3 className="text-xl font-bold text-gray-800">{viewCust.name}</h3>
                {viewCust.company && <p className="text-gray-500 text-sm">{viewCust.company}</p>}
                
                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400 block text-xs">Kontak Person</span>
                    <span className="font-medium text-gray-800">{viewCust.contact_person || "-"}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-xs">Telepon</span>
                    <span className="font-medium text-gray-800">{viewCust.phone || "-"}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-400 block text-xs">Email</span>
                    <span className="font-medium text-gray-800">{viewCust.email || "-"}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-400 block text-xs">Alamat</span>
                    <span className="font-medium text-gray-800">{viewCust.address || "-"}</span>
                  </div>
                </div>
              </div>

              {/* Armada Kendaraan */}
              <div className="mb-6">
                <h4 className="text-sm font-bold text-gray-800 border-b pb-2 mb-3">Armada Kendaraan ({viewCust.trucks?.length || 0})</h4>
                {!viewCust.trucks || viewCust.trucks.length === 0 ? (
                  <p className="text-gray-400 text-sm italic">Belum ada armada yang didaftarkan.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {viewCust.trucks.map((t, i) => (
                      <div key={i} className="flex justify-between items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
                        <div>
                          <span className="font-bold text-gray-800 block">{t.license_plate}</span>
                          <span className="text-xs text-gray-500">Supir: {t.driver_name || "Tanpa Nama"}</span>
                        </div>
                        <span className="text-xs font-medium bg-emerald-100 text-emerald-700 px-2 py-1 rounded">
                          {t.vehicle_type}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Preferensi Material */}
              <div>
                <h4 className="text-sm font-bold text-gray-800 border-b pb-2 mb-3">Preferensi Material</h4>
                {(!viewCust.material_preferences || viewCust.material_preferences.length === 0) ? (
                  <p className="text-gray-400 text-sm italic">Belum ada preferensi material.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {viewCust.material_preferences.map((m, i) => (
                      <div key={i} className="flex justify-between items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
                        <div>
                          <span className="font-bold text-gray-800 block">{m.material_type} ({m.unit})</span>
                          {m.vehicle_type && <span className="text-xs text-gray-500">Kendaraan: {m.vehicle_type}</span>}
                        </div>
                        {m.unit_price && (
                          <span className="text-sm font-bold text-emerald-600">
                            {formatIDR(m.unit_price)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {isGM && (
              <div className="p-4 sm:px-6 sm:py-4 border-t border-gray-100 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 rounded-b-2xl bg-gray-50 mt-auto">
                <button
                  onClick={() => {
                    setConfirmDeleteCust(viewCust);
                    setViewCust(null);
                  }}
                  className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl text-sm font-semibold transition-colors"
                  title="Hapus Pelanggan"
                >
                  <Trash2 size={16} /> <span className="hidden sm:inline">Hapus</span>
                </button>
                <div className="flex items-center gap-2 flex-1 justify-end">
                  <button
                    onClick={() => {
                      openCustModal(viewCust);
                      setViewCust(null);
                    }}
                    className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2.5 sm:py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors flex-1 sm:flex-none text-center"
                  >
                    <Pencil size={15} className="flex-shrink-0" /> 
                    <span className="leading-tight">Edit<br className="sm:hidden" /> Data</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Project Detail Modal */}
      {viewProj && !showProjModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setViewProj(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-2xl">
              <div className="flex items-center gap-2">
                <Briefcase size={18} className="text-emerald-600" />
                <h2 className="text-base font-semibold text-gray-800">Detail Proyek</h2>
              </div>
              <button onClick={() => setViewProj(null)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="px-6 py-5 overflow-y-auto">
              <div className="mb-6 flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold text-gray-800">{viewProj.name}</h3>
                  {viewProj.client_name && <p className="text-gray-500 text-sm">{viewProj.client_name}</p>}
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${
                  viewProj.status === 'completed' ? 'bg-green-100 text-green-700' :
                  viewProj.status === 'paused' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {viewProj.status}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm mb-6">
                <div>
                  <span className="text-gray-400 block text-xs">Lokasi</span>
                  <span className="font-medium text-gray-800">{viewProj.location || "-"}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-xs">Tipe Pengukuran</span>
                  <span className="font-medium text-gray-800 capitalize">{viewProj.measurement_type || "Tonase"}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-xs">Budget</span>
                  <span className="font-medium text-emerald-700">{formatIDR(viewProj.budget)}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-xs">Pengeluaran</span>
                  <span className="font-medium text-rose-600">{formatIDR(viewProj.budget_used)}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-400 block text-xs">Keterangan / Catatan</span>
                  <span className="font-medium text-gray-800 whitespace-pre-wrap">{viewProj.notes || "-"}</span>
                </div>
              </div>

              {/* Target Material */}
              <div className="mb-6">
                <h4 className="text-sm font-bold text-gray-800 border-b pb-2 mb-3">Target Material</h4>
                {(!viewProj.material_items || viewProj.material_items.length === 0) ? (
                  <p className="text-gray-400 text-sm italic">Belum ada target material.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {viewProj.material_items.map((m, i) => (
                      <div key={i} className="flex justify-between items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
                        <div>
                          <span className="font-bold text-gray-800 block">{m.material_type}</span>
                          {m.unit_price && <span className="text-xs text-gray-500">{formatIDR(m.unit_price)} / {m.unit}</span>}
                        </div>
                        <span className="text-sm font-bold text-blue-600">
                          {m.target_quantity} {m.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Assignments */}
              <div className="mb-6 grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-bold text-gray-800 border-b pb-2 mb-3">Field Staff</h4>
                  {(!viewProj.assigned_users || viewProj.assigned_users.length === 0) ? (
                    <p className="text-gray-400 text-sm italic">Tidak ada petugas ditugaskan.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {viewProj.assigned_users.map((u: any) => {
                        const displayName = u.full_name || u.email || `User ID: ${u.id}`;
                        return (
                          <div key={u.id} className="text-sm px-3 py-2 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-lg flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-emerald-200 text-emerald-700 flex items-center justify-center font-bold text-xs">
                              {displayName.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium">{displayName}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-800 border-b pb-2 mb-3">Pekerja Proyek</h4>
                  {(!viewProj.assigned_employees || viewProj.assigned_employees.length === 0) ? (
                    <p className="text-gray-400 text-sm italic">Tidak ada pekerja ditugaskan.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {viewProj.assigned_employees.map((emp: any) => {
                        const displayName = emp.name || `Pekerja ID: ${emp.id}`;
                        return (
                          <div key={emp.id} className="text-sm px-3 py-2 bg-blue-50 border border-blue-100 text-blue-800 rounded-lg flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-blue-200 text-blue-700 flex items-center justify-center font-bold text-xs">
                              {displayName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium">{displayName}</div>
                              {emp.position && <div className="text-xs opacity-70">{emp.position}</div>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {isGM && (
              <div className="p-4 sm:px-6 sm:py-4 border-t border-gray-100 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 rounded-b-2xl bg-gray-50 mt-auto">
                <button
                  onClick={() => {
                    setConfirmDeleteProj(viewProj);
                    setViewProj(null);
                  }}
                  className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl text-sm font-semibold transition-colors"
                  title="Hapus Proyek"
                >
                  <Trash2 size={16} /> <span className="hidden sm:inline">Hapus</span>
                </button>
                <div className="flex items-center gap-2 flex-1 justify-end">
                  <button
                    onClick={() => {
                      setShowHaulingModal(viewProj);
                    }}
                    className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2.5 sm:py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-xl text-sm font-semibold transition-colors flex-1 sm:flex-none text-center"
                  >
                    <Truck size={15} className="flex-shrink-0" /> 
                    <span className="leading-tight">Harga<br className="sm:hidden" /> Hauling</span>
                  </button>
                  <button
                    onClick={() => {
                      openProjModal(viewProj);
                      setViewProj(null);
                    }}
                    className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2.5 sm:py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors flex-1 sm:flex-none text-center"
                  >
                    <Pencil size={15} className="flex-shrink-0" /> 
                    <span className="leading-tight">Edit<br className="sm:hidden" /> Proyek</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showHaulingModal && (
        <HaulingPricesModal
          projectId={showHaulingModal.id!}
          projectName={showHaulingModal.name}
          onClose={() => setShowHaulingModal(null)}
        />
      )}

      {/* Delete Confirmation */}
      {(confirmDeleteProj || confirmDeleteCust) && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 text-center max-w-sm">
            <Trash2 size={30} className="text-red-500 mx-auto mb-3" />
            <h3 className="font-bold text-lg mb-2">Hapus {activeTab === "projects" ? "Proyek" : "Pelanggan"}?</h3>
            <p className="text-sm text-gray-500 mb-6">{(confirmDeleteProj || confirmDeleteCust)?.name}</p>
            <div className="flex gap-2">
              <button onClick={() => { setConfirmDeleteProj(null); setConfirmDeleteCust(null); }} className="flex-1 py-2 border rounded-xl text-sm">Batal</button>
              <button 
                onClick={handleDelete} 
                disabled={deleteProjectMutation.isPending || deleteCustomerMutation.isPending} 
                className="flex-1 py-2 bg-red-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2"
              >
                {(deleteProjectMutation.isPending || deleteCustomerMutation.isPending) && <Loader2 size={14} className="animate-spin" />}
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
