import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/apiClient';

export interface PayrollRecord {
  id: number;
  employee_id: number;
  employee_name: string;
  period_start: string;
  period_end: string;
  basic_salary: number;
  overtime_amount: number;
  bonus: number;
  allowance: number;
  loan_deduction: number;
  debt_deduction: number;
  other_deduction: number;
  net_salary: number;
  payment_status: 'pending' | 'approved' | 'paid';
  project_id?: number;
  project_name?: string;
}

export const usePayrollRecords = (params?: { employee_id?: number; period_start?: string; period_end?: string; payment_status?: string }) => {
  return useQuery({
    queryKey: ['payroll', params],
    queryFn: async () => {
      const response = await apiClient.get<PayrollRecord[]>('/employees/payroll', { params });
      return response.data;
    },
  });
};

export const useCalculatePayroll = () => {
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post('/employees/payroll/calculate', data);
      return response.data;
    },
  });
};

export const useCreatePayroll = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (newPayroll: any) => {
      const response = await apiClient.post<PayrollRecord>('/employees/payroll', newPayroll);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
    },
  });
};

export const useUpdatePayroll = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await apiClient.put<PayrollRecord>(`/employees/payroll/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
    },
  });
};

export const useApprovePayroll = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, approval_note }: { id: number; approval_note?: string }) => {
      const response = await apiClient.put<PayrollRecord>(`/employees/payroll/${id}/approve`, { approval_note });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
    },
  });
};

export const usePayPayroll = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await apiClient.put<PayrollRecord>(`/employees/payroll/${id}/pay`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
    },
  });
};

export const useUnpayPayroll = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await apiClient.put<PayrollRecord>(`/employees/payroll/${id}/unpay`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
    },
  });
};

export const useDeletePayroll = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/employees/payroll/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
    },
  });
};
