import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/apiClient';

export interface Employee {
  id: number;
  employee_code: string;
  name: string;
  position: string;
  department: string;
  status: string;
  is_active: boolean;
  has_loan: boolean;
  has_debt: boolean;
  daily_salary?: number;
  loan_balance?: number;
  loan_deduction_per_period?: number;
}

export const useEmployees = (params?: { department?: string; status?: string; show_inactive?: boolean }) => {
  return useQuery({
    queryKey: ['employees', params],
    queryFn: async () => {
      const response = await apiClient.get<Employee[]>('/employees/employees', { params });
      return response.data;
    },
  });
};

export const useCreateEmployee = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (newEmployee: Partial<Employee>) => {
      const response = await apiClient.post<Employee>('/employees/employees', newEmployee);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
};

export const useUpdateEmployee = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Employee> }) => {
      const response = await apiClient.put<Employee>(`/employees/employees/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
};

export const useDeleteEmployee = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/employees/employees/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
};
