import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/apiClient';

export interface Attendance {
  id: number;
  employee_id: number;
  date: string;
  status: string;
  check_in?: string | null;
  check_out?: string | null;
  work_hours?: number;
  notes?: string;
}

export const useAttendance = (params?: { employee_id?: string; start_date?: string; end_date?: string }) => {
  return useQuery<Attendance[], Error>({
    queryKey: ['attendance', params],
    queryFn: async () => {
      const response = await apiClient.get<Attendance[]>('/employees/attendance', { params });
      return response.data;
    },
  });
};

export const useCreateAttendance = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Attendance>) => {
      const response = await apiClient.post<Attendance>('/employees/attendance', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
  });
};

export const useUpdateAttendance = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Attendance> }) => {
      const response = await apiClient.put<Attendance>(`/employees/attendance/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
  });
};

export const useDeleteAttendance = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/employees/attendance/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
  });
};
