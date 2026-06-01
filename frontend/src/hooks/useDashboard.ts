import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/apiClient';
import { toast } from 'sonner';

export const useDashboardStats = () => {
  return useQuery({
    queryKey: ['dashboardStats'],
    queryFn: async () => {
      const { data } = await apiClient.get('/dashboard/stats');
      return data;
    },
  });
};

export const usePayrollSummary = () => {
  return useQuery({
    queryKey: ['payrollSummary'],
    queryFn: async () => {
      const { data } = await apiClient.get('/dashboard/payroll-summary');
      return data;
    },
  });
};

export const useFuelEfficiency = (days: number = 30) => {
  return useQuery({
    queryKey: ['fuelEfficiency', days],
    queryFn: async () => {
      const { data } = await apiClient.get(`/fuel/efficiency?days=${days}`);
      return data;
    },
  });
};

export const useFuelEquipmentReport = (days: number = 30) => {
  return useQuery({
    queryKey: ['fuelEquipmentReport', days],
    queryFn: async () => {
      const { data } = await apiClient.get(`/fuel/equipment-report?days=${days}`);
      return data;
    },
  });
};

export const useDashboardEquipment = () => {
  return useQuery({
    queryKey: ['dashboardEquipment'],
    queryFn: async () => {
      const { data } = await apiClient.get('/dashboard/equipment');
      return data;
    },
  });
};

export const useDashboardEmployees = () => {
  return useQuery({
    queryKey: ['dashboardEmployees'],
    queryFn: async () => {
      const { data } = await apiClient.get('/dashboard/employees');
      return data;
    },
  });
};

export const useDashboardProjects = () => {
  return useQuery({
    queryKey: ['dashboardProjects'],
    queryFn: async () => {
      const { data } = await apiClient.get('/dashboard/projects');
      return data;
    },
  });
};

export const useFinanceSummary = (enabled: boolean = false) => {
  return useQuery({
    queryKey: ['financeSummary'],
    queryFn: async () => {
      const { data } = await apiClient.get('/dashboard/finance-summary');
      return data;
    },
    enabled,
  });
};

export const useDailyReport = (date: string) => {
  return useQuery({
    queryKey: ['dailyReport', date],
    queryFn: async () => {
      if (!date) return null;
      const { data } = await apiClient.get(`/dashboard/daily-report?report_date=${date}`);
      return data;
    },
    enabled: !!date,
  });
};

export const useTodayAttendance = (startDate: string, endDate: string, enabled: boolean = false) => {
  return useQuery({
    queryKey: ['todayAttendance', startDate, endDate],
    queryFn: async () => {
      const { data } = await apiClient.get(`/employees/attendance?start_date=${startDate}&end_date=${endDate}`);
      return data;
    },
    enabled,
  });
};

// --- Mutations ---

export const useApprovePayroll = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payrollId: number) => {
      const { data } = await apiClient.put(`/employees/payroll/${payrollId}/approve`);
      return data;
    },
    onSuccess: () => {
      toast.success('Slip gaji berhasil disetujui!');
      queryClient.invalidateQueries({ queryKey: ['payrollSummary'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Gagal approve payroll');
    },
  });
};

export const useApproveFuel = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action }: { id: number; action: 'approved' | 'rejected' }) => {
      const { data } = await apiClient.put(`/fuel/price/${id}/approve?status=${action}`);
      return data;
    },
    onSuccess: (_, variables) => {
      toast.success(`Pembelian BBM ${variables.action === 'approved' ? 'disetujui' : 'ditolak'}`);
      queryClient.invalidateQueries({ queryKey: ['financeSummary'] });
      queryClient.invalidateQueries({ queryKey: ['fuelEfficiency'] });
      queryClient.invalidateQueries({ queryKey: ['fuelEquipmentReport'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Gagal memproses pembelian BBM');
    },
  });
};

export const useMarkPaid = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ type, id }: { type: 'expense' | 'fuel' | 'payroll' | 'invoice'; id: number }) => {
      let endpoint = '';
      if (type === 'expense') endpoint = `/expenses/${id}/pay`;
      else if (type === 'fuel') endpoint = `/fuel/price/${id}/pay`;
      else if (type === 'payroll') endpoint = `/employees/payroll/${id}/pay`;
      else if (type === 'invoice') endpoint = `/invoices/${id}/pay`;
      
      const { data } = await apiClient.put(endpoint);
      return data;
    },
    onSuccess: () => {
      toast.success('Berhasil ditandai sebagai lunas!');
      queryClient.invalidateQueries({ queryKey: ['financeSummary'] });
      queryClient.invalidateQueries({ queryKey: ['dailyReport'] });
      queryClient.invalidateQueries({ queryKey: ['payrollSummary'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Terjadi kesalahan');
    },
  });
};

export const useAttendanceAction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ employeeId, action, attendanceId, date, timeStr }: { 
      employeeId?: number; 
      action: 'check_in' | 'check_out' | 'delete'; 
      attendanceId?: number;
      date?: string;
      timeStr?: string;
    }) => {
      if (action === 'check_in') {
        const { data } = await apiClient.post('/employees/attendance', {
          employee_id: employeeId,
          date,
          check_in: timeStr,
        });
        return data;
      } else if (action === 'check_out') {
        const { data } = await apiClient.put(`/employees/attendance/${attendanceId}`, {
          check_out: timeStr,
        });
        return data;
      } else if (action === 'delete') {
        const { data } = await apiClient.delete(`/employees/attendance/${attendanceId}`);
        return data;
      }
    },
    onSuccess: (_, variables) => {
      if (variables.action === 'delete') {
        toast.success('Absensi berhasil dihapus!');
      } else {
        toast.success(variables.action === 'check_in' ? 'Check In berhasil!' : 'Check Out berhasil!');
      }
      queryClient.invalidateQueries({ queryKey: ['todayAttendance'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Gagal menyimpan absensi');
    },
  });
};
