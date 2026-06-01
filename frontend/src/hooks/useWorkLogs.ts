import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/apiClient';

export interface WorkLog {
  id: number;
  equipment_id: number;
  equipment_name?: string;
  equipment_type?: string;
  input_method: 'HM' | 'MANUAL';
  hm_start?: number | null;
  hm_end?: number | null;
  total_hours: number;
  rental_discount_hours?: number;
  rental_cost_total?: number;
  project_id?: number | null;
  project_name?: string;
  operator_name?: string;
  work_description?: string;
  work_date: string;
}

export interface WorkLogStats {
  total_hours_worked: number;
  total_work_days: number;
  avg_hours_per_day: number;
  equipment_count: number;
  hm_active_count: number;
  manual_count: number;
}

export const useWorkLogs = (options?: any) => {
  return useQuery<WorkLog[], Error>({
    queryKey: ['work-logs'],
    queryFn: async () => {
      const response = await apiClient.get<WorkLog[]>('/work-logs');
      return response.data;
    },
    ...options
  });
};

export const useWorkLogStats = (options?: any) => {
  return useQuery<WorkLogStats, Error>({
    queryKey: ['work-logs-stats'],
    queryFn: async () => {
      const response = await apiClient.get<WorkLogStats>('/work-logs/stats/summary');
      return response.data;
    },
    ...options
  });
};

export const useCreateWorkLog = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<WorkLog>) => {
      const response = await apiClient.post('/work-logs', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-logs'] });
      queryClient.invalidateQueries({ queryKey: ['work-logs-stats'] });
    },
  });
};

export const useUpdateWorkLog = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<WorkLog> }) => {
      const response = await apiClient.put(`/work-logs/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-logs'] });
      queryClient.invalidateQueries({ queryKey: ['work-logs-stats'] });
    },
  });
};

export const useDeleteWorkLog = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await apiClient.delete(`/work-logs/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-logs'] });
      queryClient.invalidateQueries({ queryKey: ['work-logs-stats'] });
    },
  });
};
