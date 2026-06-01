import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/apiClient';

export interface FuelLog {
  id: number;
  equipment_id: number;
  equipment_name?: string;
  equipment_type?: string;
  liters_filled: number;
  refuel_date: string;
  location?: string;
  photo_url?: string;
  notes?: string;
}

export interface FuelStock {
  current_stock: number;
  total_purchased: number;
  total_consumed: number;
}

export interface FuelStats {
  total_fuel_consumed: number;
  equipment_count: number;
}

export const useFuelLogs = (options?: any) => {
  return useQuery({
    queryKey: ['fuel-logs'],
    queryFn: async () => {
      const response = await apiClient.get<FuelLog[]>('/fuel/logs');
      return response.data;
    },
    ...options
  });
};

export const useFuelEfficiency = (options?: any) => {
  return useQuery({
    queryKey: ['fuel-efficiency'],
    queryFn: async () => {
      const response = await apiClient.get<FuelStats>('/fuel/efficiency');
      return response.data;
    },
    ...options
  });
};

export const useFuelStock = (options?: any) => {
  return useQuery<FuelStock, Error>({
    queryKey: ['fuel-stock'],
    queryFn: async () => {
      const response = await apiClient.get<FuelStock>('/fuel/stock');
      return response.data;
    },
    ...options
  });
};

export const useCreateFuelLog = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<FuelLog>) => {
      const response = await apiClient.post<FuelLog>('/fuel/refuel', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fuel-logs'] });
      queryClient.invalidateQueries({ queryKey: ['fuel-efficiency'] });
      queryClient.invalidateQueries({ queryKey: ['fuel-stock'] });
    },
  });
};

export const useUpdateFuelLog = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number, data: Partial<FuelLog> }) => {
      const response = await apiClient.put<FuelLog>(`/fuel/logs/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fuel-logs'] });
      queryClient.invalidateQueries({ queryKey: ['fuel-efficiency'] });
      queryClient.invalidateQueries({ queryKey: ['fuel-stock'] });
    },
  });
};

export const useDeleteFuelLog = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/fuel/logs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fuel-logs'] });
      queryClient.invalidateQueries({ queryKey: ['fuel-efficiency'] });
      queryClient.invalidateQueries({ queryKey: ['fuel-stock'] });
    },
  });
};

export interface FuelPurchase {
  id: number;
  price_per_liter: number;
  fuel_type: string;
  effective_date: string;
  created_at: string;
  liters: number;
  total_price: number;
  vendor_name?: string;
  project_id?: number;
  notes?: string;
  approval_status: string;
}

export const useFuelPurchases = (params?: { start_date?: string, end_date?: string }, options?: any) => {
  return useQuery<FuelPurchase[], Error>({
    queryKey: ['fuel-purchases', params],
    queryFn: async () => {
      const response = await apiClient.get<FuelPurchase[]>('/fuel/price', { params });
      return response.data;
    },
    ...options
  });
};

export const useFuelVendorsList = (options?: any) => {
  return useQuery<string[], Error>({
    queryKey: ['fuel-vendors-list'],
    queryFn: async () => {
      const response = await apiClient.get<string[]>('/fuel/vendors');
      return response.data;
    },
    ...options
  });
};

export const useCreateFuelPurchase = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<FuelPurchase>) => {
      const response = await apiClient.post<FuelPurchase>('/fuel/price', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fuel-purchases'] });
      queryClient.invalidateQueries({ queryKey: ['fuel-stock'] });
    },
  });
};

export const useUpdateFuelPurchase = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number, data: Partial<FuelPurchase> }) => {
      const response = await apiClient.put<FuelPurchase>(`/fuel/price/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fuel-purchases'] });
      queryClient.invalidateQueries({ queryKey: ['fuel-stock'] });
    },
  });
};

export const useDeleteFuelPurchase = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/fuel/price/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fuel-purchases'] });
      queryClient.invalidateQueries({ queryKey: ['fuel-stock'] });
    },
  });
};

export const useApproveFuelPurchase = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: number, status: string }) => {
      const response = await apiClient.put(`/fuel/price/${id}/approve?status=${status}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fuel-purchases'] });
      queryClient.invalidateQueries({ queryKey: ['fuel-stock'] });
    },
  });
};
