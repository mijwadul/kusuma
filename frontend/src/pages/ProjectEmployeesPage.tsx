import React from 'react';
import { useEmployees } from '../hooks/useEmployees';
import { Users, Loader2, Briefcase } from 'lucide-react';

export default function ProjectEmployeesPage() {
  const { data: employees = [], isLoading } = useEmployees(0, 100);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-10">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Pekerja Proyek</h1>
        <p className="text-gray-500 text-sm mt-1">Daftar pekerja yang ditugaskan pada proyek Anda</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
            <span className="ml-3 text-gray-500">Memuat data pekerja...</span>
          </div>
        ) : employees.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Users className="w-16 h-16 mb-4 text-gray-300" />
            <p className="text-lg font-medium text-gray-600">Belum ada pekerja</p>
            <p className="text-sm">Tidak ada pekerja yang ditugaskan di proyek Anda saat ini.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-gray-700 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 font-semibold">Nama Pekerja</th>
                  <th className="px-6 py-4 font-semibold">Posisi</th>
                  <th className="px-6 py-4 font-semibold">Departemen</th>
                  <th className="px-6 py-4 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-bold">
                          {emp.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-gray-800">{emp.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Briefcase className="w-4 h-4 text-gray-400" />
                        {emp.position || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4">{emp.department || '-'}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        emp.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {emp.is_active ? 'Aktif' : 'Non-Aktif'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
