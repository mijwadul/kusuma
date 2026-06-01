import React from 'react';
import { ClipboardCheck, Loader2, CheckCircle, Trash2 } from "lucide-react";
import { toLocalDateInput } from "../../utils/formatters";

const AttendancePanel = ({
  role,
  operationEmployees,
  selectedFieldEmployee,
  setSelectedFieldEmployee,
  todayAttendance,
  attendanceLoading,
  handleAttendanceAction,
  setDeleteAttendanceModal
}) => {
  if (role !== "field") return null;

  return (
    <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-all duration-300">
      <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-4">
        <ClipboardCheck className="w-5 h-5 text-blue-600" />
        Absensi Pekerja Lapangan (Operation)
      </h2>
      
      <div className="flex flex-col sm:flex-row gap-4 items-end">
        <div className="flex-1 w-full">
          <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Karyawan</label>
          <select 
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0D9488]"
            value={selectedFieldEmployee}
            onChange={(e) => setSelectedFieldEmployee(e.target.value)}
          >
            <option value="">-- Pilih Pekerja --</option>
            {operationEmployees.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.name}</option>
            ))}
          </select>
        </div>
        
        <div className="w-full sm:w-auto">
          {(() => {
             const selectedId = Number(selectedFieldEmployee);
             if (!selectedId) return <button disabled className="w-full sm:w-auto px-6 py-2 bg-gray-300 text-white font-medium rounded-lg transition-colors">Pilih Pekerja</button>;
             
             const records = todayAttendance.filter(a => a.employee_id === selectedId);
             const todayStr = toLocalDateInput(new Date());
             let currentRecord = records.find(a => a.date === todayStr);
             if (!currentRecord) {
                currentRecord = records.find(a => !a.check_out);
             }
             
             if (!currentRecord) {
                return (
                  <button 
                    onClick={() => handleAttendanceAction(selectedId, 'check_in')}
                    disabled={attendanceLoading}
                    className="w-full sm:w-auto px-6 py-2 bg-[#0D9488] hover:bg-[#0F766E] text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-70"
                  >
                    {attendanceLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Check In
                  </button>
                );
             } else {
                return (
                  <div className="flex flex-col sm:flex-row items-center gap-2 w-full">
                    {!currentRecord.check_out ? (
                      <button 
                        onClick={() => handleAttendanceAction(selectedId, 'check_out', currentRecord.id)}
                        disabled={attendanceLoading}
                        className="w-full sm:w-auto px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-70"
                      >
                        {attendanceLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                        Check Out
                      </button>
                    ) : (
                      <button disabled className="w-full sm:w-auto px-6 py-2 bg-green-100 text-green-700 border border-green-200 font-medium rounded-lg flex items-center justify-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        Selesai Shift
                      </button>
                    )}
                    <button 
                      onClick={() => setDeleteAttendanceModal({ isOpen: true, employeeId: selectedId, attendanceId: currentRecord.id })}
                      disabled={attendanceLoading}
                      className="w-full sm:w-auto p-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg flex items-center justify-center transition-colors disabled:opacity-70"
                      title="Hapus Absensi Hari Ini"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                );
             }
          })()}
        </div>
      </div>
    </div>
  );
};

export default AttendancePanel;
