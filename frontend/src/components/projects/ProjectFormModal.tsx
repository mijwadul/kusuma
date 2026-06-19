import React from 'react';
import { X, Plus, Trash2, Loader2 } from 'lucide-react';
import { Project } from '../../hooks/useProjects';

interface ProjectFormModalProps {
  show: boolean;
  onClose: () => void;
  editDataProj: Project | null;
  projForm: Partial<Project>;
  setProjForm: React.Dispatch<React.SetStateAction<Partial<Project>>>;
  meta: any;
  allUsers: any[];
  allEmployees: any[];
  saveProject: (e: React.FormEvent) => void;
  isPending: boolean;
  addProjMaterial: () => void;
  updateProjMaterial: (idx: number, field: string, value: string) => void;
  removeProjMaterial: (idx: number) => void;
}

export default function ProjectFormModal({
  show,
  onClose,
  editDataProj,
  projForm,
  setProjForm,
  meta,
  allUsers,
  allEmployees,
  saveProject,
  isPending,
  addProjMaterial,
  updateProjMaterial,
  removeProjMaterial,
}: ProjectFormModalProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 whitespace-nowrap border-b flex justify-between items-center sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold">{editDataProj ? "Edit Proyek" : "Tambah Proyek"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
        </div>
        <form onSubmit={saveProject} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Nama Proyek *</label>
              <input required value={projForm.name || ""} onChange={e => setProjForm(p => ({...p, name: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm mb-1">Klien / Pemesan</label>
              <input value={projForm.client_name || ""} onChange={e => setProjForm(p => ({...p, client_name: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm mb-1">Lokasi</label>
              <input value={projForm.location || ""} onChange={e => setProjForm(p => ({...p, location: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm mb-1">Budget (Rp)</label>
              <input type="number" value={projForm.budget || ""} onChange={e => setProjForm(p => ({...p, budget: parseFloat(e.target.value) || 0}))} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm mb-1">Status</label>
              <select value={projForm.status || "ongoing"} onChange={e => setProjForm(p => ({...p, status: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="ongoing">Ongoing</option>
                <option value="completed">Completed</option>
                <option value="paused">Paused</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">Tipe Pengukuran</label>
              <select value={projForm.measurement_type || "tonase"} onChange={e => setProjForm(p => ({...p, measurement_type: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="tonase">Tonase (Ton)</option>
                <option value="kubikasi">Kubikasi (m3)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">Tugaskan Field Staff</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {projForm.assigned_user_ids?.map((id, i) => {
                  const user = allUsers.find(u => u.id === id);
                  const displayName = user ? (user.full_name || user.email) : `User ID: ${id}`;
                  return <span key={i} className="bg-emerald-100 text-emerald-800 text-xs px-2 py-1 rounded flex items-center gap-1">{displayName} <X size={12} className="cursor-pointer hover:text-emerald-950" onClick={() => setProjForm(p => ({...p, assigned_user_ids: p.assigned_user_ids?.filter(uid => uid !== id)}))}/></span>
                })}
              </div>
              <select value="" onChange={e => {
                const val = parseInt(e.target.value);
                if (val && !projForm.assigned_user_ids?.includes(val)) {
                  setProjForm(p => ({...p, assigned_user_ids: [...(p.assigned_user_ids || []), val]}));
                }
              }} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">-- Tambah Field Staff --</option>
                {allUsers.filter(u => (u.role === 'field' || u.role === 'helper') && !projForm.assigned_user_ids?.includes(u.id)).map(u => (
                  <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm mb-1">Tugaskan Pekerja</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {projForm.assigned_employee_ids?.map((id, i) => {
                  const emp = allEmployees.find(e => e.id === id);
                  const displayName = emp?.name || `Pekerja ID: ${id}`;
                  return <span key={i} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded flex items-center gap-1">{displayName} <X size={12} className="cursor-pointer hover:text-blue-950" onClick={() => setProjForm(p => ({...p, assigned_employee_ids: p.assigned_employee_ids?.filter(eid => eid !== id)}))}/></span>
                })}
              </div>
              <select value="" onChange={e => {
                const val = parseInt(e.target.value);
                if (val && !projForm.assigned_employee_ids?.includes(val)) {
                  setProjForm(p => ({...p, assigned_employee_ids: [...(p.assigned_employee_ids || []), val]}));
                }
              }} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">-- Tambah Pekerja --</option>
                {allEmployees.filter(emp => emp.is_active && !projForm.assigned_employee_ids?.includes(emp.id)).map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name} ({emp.position || '-'})</option>
                ))}
              </select>
              <p className="text-[10px] text-gray-500 mt-1">Pekerja yang ditugaskan akan tampil di menu Field Staff</p>
            </div>
          </div>

          <div className="pt-4 border-t">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-sm">Target Material</h3>
              <button type="button" onClick={addProjMaterial} className="text-xs flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-1 rounded">
                <Plus size={14}/> Tambah Material
              </button>
            </div>
            {projForm.material_items?.map((m, idx) => (
              <div key={idx} className="flex items-end gap-2 mb-2 p-2 bg-gray-50 rounded border">
                <div className="flex-1">
                  <label className="block text-xs mb-1">Material</label>
                  <select value={m.material_type} onChange={e => updateProjMaterial(idx, "material_type", e.target.value)} className="w-full border rounded text-sm p-1.5">
                    {meta?.material_types?.map((mt: string) => <option key={mt} value={mt}>{mt}</option>)}
                  </select>
                </div>
                <div className="w-24">
                  <label className="block text-xs mb-1">Target Qty</label>
                  <input type="number" required value={m.target_quantity} onChange={e => updateProjMaterial(idx, "target_quantity", e.target.value)} className="w-full border rounded text-sm p-1.5" />
                </div>
                <div className="w-24">
                  <label className="block text-xs mb-1">Satuan</label>
                  <select value={m.unit} onChange={e => updateProjMaterial(idx, "unit", e.target.value)} className="w-full border rounded text-sm p-1.5">
                    {(meta?.material_units?.[m.material_type] || meta?.all_units || []).map((u: string) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs mb-1">Harga/Satuan (opsional)</label>
                  <input type="number" placeholder="Rp..." value={m.unit_price || ""} onChange={e => updateProjMaterial(idx, "unit_price", e.target.value)} className="w-full border rounded text-sm p-1.5" />
                </div>
                <button type="button" onClick={() => removeProjMaterial(idx)} className="p-2 text-red-500 hover:bg-red-100 rounded mb-0.5"><Trash2 size={14}/></button>
              </div>
            ))}
            {(!projForm.material_items || projForm.material_items.length === 0) && <p className="text-xs text-gray-400 italic">Belum ada target material.</p>}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-xl text-sm">Batal</button>
            <button type="submit" disabled={isPending} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold flex items-center gap-2">
              {isPending && <Loader2 size={14} className="animate-spin" />}
              Simpan Proyek
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
