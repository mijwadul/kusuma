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
  split_details?: string | null;
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

export interface WorkLogFilterParams {
  start_date?: string;
  end_date?: string;
  equipment_id?: number | string;
}

export const useWorkLogs = (filters?: WorkLogFilterParams, options?: any) => {
  return useQuery<WorkLog[], Error>({
    queryKey: ['work-logs', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.start_date) params.append('start_date', filters.start_date);
      if (filters?.end_date) params.append('end_date', filters.end_date);
      if (filters?.equipment_id) params.append('equipment_id', filters.equipment_id.toString());
      
      const queryString = params.toString();
      const url = queryString ? `/work-logs?${queryString}` : '/work-logs';
      const response = await apiClient.get<WorkLog[]>(url);
      return response.data;
    },
    ...options
  });
};

export const useWorkLogStats = (filters?: WorkLogFilterParams, options?: any) => {
  return useQuery<WorkLogStats, Error>({
    queryKey: ['work-logs-stats', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.start_date) params.append('start_date', filters.start_date);
      if (filters?.end_date) params.append('end_date', filters.end_date);
      if (filters?.equipment_id) params.append('equipment_id', filters.equipment_id.toString());
      
      const queryString = params.toString();
      const url = queryString ? `/work-logs/stats/summary?${queryString}` : '/work-logs/stats/summary';
      const response = await apiClient.get<WorkLogStats>(url);
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
