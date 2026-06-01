import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/apiClient';

export interface Loan {
  id: number;
  employee_id: number;
  nominal: number;
  loan_date: string;
  remaining_balance: number;
  deduction_per_period: number;
  is_active: boolean;
  notes?: string;
  created_at: string;
}

export const useLoans = (employeeId?: number | null, options?: any) => {
  return useQuery({
    queryKey: ['loans', employeeId],
    queryFn: async () => {
      const url = employeeId 
        ? `/employees/loans/employee/${employeeId}` 
        : `/employees/loans`;
      const response = await apiClient.get<Loan[]>(url);
      return response.data;
    },
    ...options
  });
};

export const useCreateLoan = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ employeeId, data }: { employeeId: number, data: Partial<Loan> }) => {
      const response = await apiClient.post<Loan>(`/employees/loans?employee_id=${employeeId}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
};

export const useUpdateLoan = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number, data: Partial<Loan> }) => {
      const response = await apiClient.put<Loan>(`/employees/loans/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
};

export const useDeleteLoan = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/employees/loans/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
};
